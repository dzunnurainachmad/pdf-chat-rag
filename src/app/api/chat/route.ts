import { NextRequest } from "next/server";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeClient } from "@/lib/pinecone";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { question, history = [], namespace } = await req.json();

  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "No question provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const pinecone = getPineconeClient();
  const pineconeIndex = pinecone.Index(
    process.env.PINECONE_INDEX || "pdf-chat-rag"
  );

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    ...(namespace ? { namespace } : {}),
  });

  // Build a richer retrieval query by including recent user history
  const recentUserMessages = history
    .filter((m: { role: string }) => m.role === "user")
    .slice(-2)
    .map((m: { content: string }) => m.content)
    .join(" ");
  const retrievalQuery = recentUserMessages
    ? `${recentUserMessages} ${question}`
    : question;

  const scoredDocs = await vectorStore.similaritySearchWithScore(retrievalQuery, 4);
  console.log(`Retrieved ${scoredDocs.length} chunks, scores: ${scoredDocs.map(([, s]) => s.toFixed(3)).join(", ")}`);

  // Filter weak matches but always keep at least 1 result
  const SCORE_THRESHOLD = 0.5;
  const filtered =
    scoredDocs.filter(([, score]) => score >= SCORE_THRESHOLD).length > 0
      ? scoredDocs.filter(([, score]) => score >= SCORE_THRESHOLD)
      : scoredDocs.slice(0, 1);

  const context = filtered
    .map(([doc], i) => `[Chunk ${i + 1}]\n${doc.pageContent}`)
    .join("\n\n");

  const sources = filtered.map(([doc, score]) => ({
    content: doc.pageContent,
    source: doc.metadata?.source ?? "unknown",
    page: doc.metadata?.page as number | undefined,
    score: Math.round(score * 100),
  }));

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
    streaming: true,
  });

  const systemPrompt = `You are a helpful assistant that answers questions strictly based on the provided context from a PDF document.
If the answer is not found in the context, say "I couldn't find that information in the document."
Do not make up information.

Context from the document:
---
${context}
---`;

  const stream = await llm.stream([
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question },
  ]);

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      // First chunk: send sources as JSON metadata
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
      );

      for await (const chunk of stream) {
        const text = typeof chunk.content === "string" ? chunk.content : "";
        if (text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`)
          );
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

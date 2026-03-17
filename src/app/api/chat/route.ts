import { NextRequest } from "next/server";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeClient } from "@/lib/pinecone";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { question, history = [] } = await req.json();

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
  });

  const relevantDocs = await vectorStore.similaritySearch(question, 4);
  console.log(`Retrieved ${relevantDocs.length} relevant chunks.`);

  const context = relevantDocs
    .map((doc, i) => `[Chunk ${i + 1}]\n${doc.pageContent}`)
    .join("\n\n");

  const sources = relevantDocs.map((doc) => ({
    content: doc.pageContent.slice(0, 200) + "…",
    source: doc.metadata?.source ?? "unknown",
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

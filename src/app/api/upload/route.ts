import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeClient } from "@/lib/pinecone";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Convert File → Buffer and parse PDF text
    //    pdf-parse is listed in serverExternalPackages so Next.js won't bundle it.
    //    Dynamic import avoids any ESM/CJS interop issues at build time.
    console.log(`Loading PDF: ${file.name} - Size: ${file.size} bytes`);
    const buffer = Buffer.from(await file.arrayBuffer());

    const pdfParseModule = await import("pdf-parse");
    // pdf-parse 1.x exports the function as module.exports (CJS).
    // Dynamic import wraps CJS exports under `.default`.
    const pdfParse = pdfParseModule.default;
    const pdfData = await pdfParse(buffer);

    const rawDocs = [new Document({ pageContent: pdfData.text })];
    console.log(`Extracted ${rawDocs[0].pageContent.length} characters.`);

    // 2. Split text into overlapping chunks
    console.log("Splitting text into chunks...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await textSplitter.splitDocuments(rawDocs);
    console.log(`Split into ${docs.length} chunks.`);

    const docsWithSource = docs.map((doc: Document) => {
      doc.metadata.source = file.name;
      return doc;
    });

    // 3. Embed & upsert into Pinecone
    console.log("Connecting to Vector DB...");
    const pinecone = getPineconeClient();
    const pineconeIndex = pinecone.Index(
      process.env.PINECONE_INDEX || "pdf-chat-rag"
    );

    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`Indexing ${docsWithSource.length} chunks into Pinecone...`);
    await PineconeStore.fromDocuments(docsWithSource, embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    });

    console.log("Successfully indexed!");

    return NextResponse.json({
      success: true,
      message: `Successfully processed "${file.name}" into ${docs.length} chunks.`,
      chunkCount: docs.length,
    });
  } catch (error: unknown) {
    console.error("Error processing PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process PDF";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

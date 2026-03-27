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

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 }
      );
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

    // Capture text per page so chunks can carry page number metadata
    const pageTexts: string[] = [];
    await pdfParse(buffer, {
      pagerender: (pageData: any) =>
        pageData.getTextContent().then((content: any) => {
          const text = content.items.map((item: any) => item.str).join(" ");
          pageTexts.push(text);
          return text;
        }),
    });

    const rawDocs = pageTexts.map(
      (text, i) =>
        new Document({ pageContent: text, metadata: { source: file.name, page: i + 1 } })
    );
    const totalChars = rawDocs.reduce((sum, d) => sum + d.pageContent.length, 0);
    console.log(`Extracted ${rawDocs.length} pages, ${totalChars} characters.`);

    // 2. Split text into overlapping chunks
    console.log("Splitting text into chunks...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await textSplitter.splitDocuments(rawDocs);
    console.log(`Split into ${docs.length} chunks.`);

    // Derive a Pinecone-safe namespace from the filename
    const namespace = file.name
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 64);

    const docsWithSource = docs;

    // 3. Embed & upsert into Pinecone (scoped to namespace)
    console.log("Connecting to Vector DB...");
    const pinecone = getPineconeClient();
    const pineconeIndex = pinecone.Index(
      process.env.PINECONE_INDEX || "pdf-chat-rag"
    );

    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`Indexing ${docsWithSource.length} chunks into namespace "${namespace}"...`);
    await PineconeStore.fromDocuments(docsWithSource, embeddings, {
      pineconeIndex,
      namespace,
      maxConcurrency: 5,
    });

    console.log("Successfully indexed!");

    return NextResponse.json({
      success: true,
      message: `Successfully processed "${file.name}" into ${docs.length} chunks.`,
      chunkCount: docs.length,
      namespace,
      fileName: file.name,
    });
  } catch (error: unknown) {
    console.error("Error processing PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process PDF";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

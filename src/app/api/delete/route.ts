import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

export const maxDuration = 30;

export async function DELETE(req: NextRequest) {
  try {
    const { namespace } = await req.json();

    if (!namespace || typeof namespace !== "string") {
      return NextResponse.json({ error: "No namespace provided" }, { status: 400 });
    }

    const pinecone = getPineconeClient();
    const pineconeIndex = pinecone.Index(
      process.env.PINECONE_INDEX || "pdf-chat-rag"
    );

    await pineconeIndex.namespace(namespace).deleteAll();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete document";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

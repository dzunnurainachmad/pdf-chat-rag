"use client";

import { useState } from "react";
import { UploadDocument } from "@/components/UploadDocument";
import { ChatInterface } from "@/components/ChatInterface";

export type PDFDoc = { name: string; namespace: string };

export default function Home() {
  const [documents, setDocuments] = useState<PDFDoc[]>([]);
  const [activeNamespace, setActiveNamespace] = useState<string | null>(null);

  const handleUploadSuccess = (doc: PDFDoc) => {
    setDocuments((prev) => {
      if (prev.find((d) => d.namespace === doc.namespace)) return prev;
      return [...prev, doc];
    });
    setActiveNamespace(doc.namespace);
  };

  const handleDelete = (namespace: string) => {
    setDocuments((prev) => prev.filter((d) => d.namespace !== namespace));
    if (activeNamespace === namespace) setActiveNamespace(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-5 border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-main flex items-center justify-center text-white font-bold text-xl">
            R
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">PDF Chat RAG</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              Retrieval-Augmented Generation
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Pane: Upload & Ingest */}
        <div className="col-span-1 lg:col-span-4 lg:sticky lg:top-32">
          <UploadDocument
            documents={documents}
            activeNamespace={activeNamespace}
            onUploadSuccess={handleUploadSuccess}
            onSelectDocument={setActiveNamespace}
            onDeleteDocument={handleDelete}
          />
        </div>

        {/* Right Pane: Chat */}
        <ChatInterface activeNamespace={activeNamespace} />
      </main>
    </div>
  );
}

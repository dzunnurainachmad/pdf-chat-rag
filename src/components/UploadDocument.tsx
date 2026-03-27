"use client";

import { useState } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  Trash2,
} from "lucide-react";
import type { PDFDoc } from "@/app/page";

type Props = {
  documents: PDFDoc[];
  activeNamespace: string | null;
  onUploadSuccess: (doc: PDFDoc) => void;
  onSelectDocument: (namespace: string) => void;
  onDeleteDocument: (namespace: string) => void;
};

export function UploadDocument({
  documents,
  activeNamespace,
  onUploadSuccess,
  onSelectDocument,
  onDeleteDocument,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingNamespace, setDeletingNamespace] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const applyFile = (f: File) => {
    if (f.type !== "application/pdf") return;
    setFile(f);
    setStatus("idle");
    setMessage("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) applyFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) applyFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setStatus("idle");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to upload");

      setStatus("success");
      setMessage(
        data.message || `File indexed successfully (${data.chunkCount} chunks)`
      );
      setFile(null);
      onUploadSuccess({ name: data.fileName, namespace: data.namespace });
    } catch (err: unknown) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "An error occurred during upload"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (namespace: string) => {
    setDeletingNamespace(namespace);
    try {
      const res = await fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      onDeleteDocument(namespace);
    } catch (err: unknown) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingNamespace(null);
    }
  };

  return (
    <div className="glass-panel rounded-xl p-6 lg:p-8 flex flex-col items-center text-center space-y-6 w-full max-w-md mx-auto">
      <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
        <UploadCloud size={32} className="text-primary" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">
          Upload Knowledge Base
        </h2>
        <p className="text-sm text-muted-foreground w-4/5 mx-auto">
          Upload a PDF to train your RAG AI. We will extract the text, split it
          into chunks, and vectorize it into Pinecone.
        </p>
      </div>

      <div className="w-full">
        <label
          htmlFor="file-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 w-full flex flex-col items-center gap-3 cursor-pointer transition-all
            ${isDragging ? "border-primary bg-primary/10 scale-[1.01]" : file ? "border-primary/50 bg-primary/5" : "border-border hover:border-accent hover:bg-accent/5"}`}
        >
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText size={28} className="text-primary" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground">
                {isDragging ? "Drop PDF here" : "Click or drag & drop PDF"}
              </span>
              <span className="text-xs">Max size: 10 MB</span>
            </div>
          )}
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full bg-primary text-primary-foreground font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <>
            <Loader size={18} className="animate-spin" />
            Indexing PDF...
          </>
        ) : (
          "Upload & Index"
        )}
      </button>

      {status === "success" && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-400/10 w-full p-3 rounded-lg border border-emerald-400/20 text-left">
          <CheckCircle size={16} className="shrink-0" />
          <p>{message}</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 w-full p-3 rounded-lg border border-red-400/20 text-left">
          <AlertCircle size={16} className="shrink-0" />
          <p>{message}</p>
        </div>
      )}

      {/* Indexed Documents List */}
      {documents.length > 0 && (
        <div className="w-full space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-left">
            Indexed Documents
          </p>
          {documents.map((doc) => {
            const isActive = doc.namespace === activeNamespace;
            const isDeleting = deletingNamespace === doc.namespace;
            return (
              <div
                key={doc.namespace}
                className={`flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm transition-all ${
                  isActive
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                }`}
              >
                <button
                  onClick={() => onSelectDocument(doc.namespace)}
                  className="flex items-center gap-2 flex-1 text-left truncate"
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </button>
                <button
                  onClick={() => handleDelete(doc.namespace)}
                  disabled={isDeleting}
                  className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Delete document"
                >
                  {isDeleting ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

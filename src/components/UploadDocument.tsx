"use client";

import { useState } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
} from "lucide-react";

export function UploadDocument() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setMessage("");
    }
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
    } catch (err: unknown) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "An error occurred during upload"
      );
    } finally {
      setIsUploading(false);
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
          className={`border-2 border-dashed rounded-lg p-8 w-full flex flex-col items-center gap-3 cursor-pointer transition-all
            ${file ? "border-primary/50 bg-primary/5" : "border-border hover:border-accent hover:bg-accent/5"}`}
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
                Click to select PDF
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
    </div>
  );
}

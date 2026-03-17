"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader, Bot, User, ChevronDown } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { content: string; source: string }[];
};

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openSource, setOpenSource] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add a placeholder assistant message we'll stream into
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", sources: [] },
    ]);

    try {
      const history = messages.map(({ role, content }) => ({ role, content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get answer");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);

            if (parsed.sources) {
              setMessages((prev) =>
                prev.map((msg, i) =>
                  i === assistantIndex ? { ...msg, sources: parsed.sources } : msg
                )
              );
            }

            if (parsed.token) {
              setMessages((prev) =>
                prev.map((msg, i) =>
                  i === assistantIndex
                    ? { ...msg, content: msg.content + parsed.token }
                    : msg
                )
              );
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      setMessages((prev) =>
        prev.map((msg, i) =>
          i === assistantIndex
            ? {
                ...msg,
                content:
                  err instanceof Error
                    ? `Error: ${err.message}`
                    : "Something went wrong.",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="col-span-1 lg:col-span-8 h-[600px] lg:h-[80vh] glass-panel rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <Bot size={20} className="text-primary" />
        <h3 className="font-semibold tracking-tight">Chat with your PDF</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
            <Bot size={40} className="opacity-30" />
            <p className="text-sm">Ask anything about the uploaded PDF.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-primary" />
              </div>
            )}

            <div className="max-w-[80%] space-y-2">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-white/5 border border-white/10 rounded-tl-sm"
                }`}
              >
                {msg.content}
                {/* Blinking cursor while streaming */}
                {isLoading && msg.role === "assistant" && i === messages.length - 1 && (
                  <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
                )}
              </div>

              {/* Sources accordion */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="ml-1">
                  <button
                    onClick={() => setOpenSource(openSource === i ? null : i)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${openSource === i ? "rotate-180" : ""}`}
                    />
                    {msg.sources.length} source chunk
                    {msg.sources.length > 1 ? "s" : ""}
                  </button>

                  {openSource === i && (
                    <div className="mt-2 space-y-2">
                      {msg.sources.map((src, j) => (
                        <div
                          key={j}
                          className="text-xs bg-white/5 border border-white/10 rounded-lg p-3 text-muted-foreground"
                        >
                          <p className="font-medium text-accent mb-1">
                            {src.source}
                          </p>
                          <p className="leading-relaxed">{src.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                <User size={16} />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-primary" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader size={16} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 bg-white/5 border border-white/10 rounded-xl p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask a question about the PDF…"
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground px-2 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-primary text-primary-foreground rounded-lg p-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

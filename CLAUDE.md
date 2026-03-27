# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (uses ipv4-first DNS)
npm run build    # Production build
npm run lint     # ESLint check
```

No test suite is configured.

## Architecture

This is a **Next.js 15 RAG (Retrieval-Augmented Generation)** app that lets users upload PDFs and ask questions about them via AI.

### Stack
- **LLM**: OpenAI GPT-4o-mini (streaming chat) + text-embedding-3-small (embeddings)
- **Vector DB**: Pinecone (via `@langchain/pinecone`)
- **RAG Framework**: LangChain
- **PDF Parsing**: `pdf-parse` (configured as an external package in `next.config.mjs` to avoid bundling issues)

### Data Flow

**Upload** (`POST /api/upload`): PDF → `pdf-parse` text → `RecursiveCharacterTextSplitter` (1000 chars, 200 overlap) → OpenAI embeddings → Pinecone upsert

**Chat** (`POST /api/chat`): Question → embed → Pinecone similarity search (top 4 chunks) → GPT-4o-mini with context → Server-Sent Events stream back to client (sources sent first, then tokens)

### Key Files
- `src/app/api/upload/route.ts` — PDF ingestion pipeline
- `src/app/api/chat/route.ts` — RAG query + SSE streaming
- `src/lib/pinecone.ts` — Pinecone client singleton
- `src/components/ChatInterface.tsx` — SSE stream parser, message history, source accordions
- `src/components/UploadDocument.tsx` — File upload UI

### Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX` (index must already exist in Pinecone)

Both API routes have a 60-second `maxDuration` for Vercel compatibility.

# Enterprise AI Research Platform

An advanced Retrieval-Augmented Generation (RAG) platform designed to process, index, and query document knowledge bases securely.

## Overview

This application serves as an enterprise-grade AI research assistant, similar to NotebookLM or Glean, allowing users to upload documents (PDF, DOCX, TXT) and interrogate them using Google Gemini. The system emphasizes accuracy, transparency, and evidence-grounded answers over generalized text generation.

## Features

- **Multi-Format Ingestion**: Supports parsing PDF, DOCX, and TXT documents.
- **In-Memory Vector Store**: Fast, precise chunk embedding and Top-K retrieval using `text-embedding-004`.
- **Grounded Verification**: Answers are strictly grounded in retrieved evidence. An explicit prompt instruction ensures claims are verified against the context.
- **Source Highlights & Citations**: Direct inline citations linked back to the exact chunk, filename, and estimated page number.
- **Conflict Detection**: Built-in instructions to identify and surface conflicting information between multiple documents without hallucinatory merging.
- **Multi-Document Comparison**: Automatically generate comparison tables when querying concepts spanning different texts.
- **Pipeline Visualization**: Real-time observability into the RAG pipeline (Parsing -> Chunking -> Embedding -> Search -> Retrieval -> Generation -> Verification).
- **Exporting**: Download research sessions as Markdown or JSON.
- **Settings Panel**: Fine-tune RAG parameters (Top-K, Chunk Size, Overlap, Similarity Threshold, Temperature).

## Technology Stack

- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Express (Node.js), Multer
- **AI/ML**: `@google/genai` (Gemini 2.5 Flash, Text Embedding 004)
- **Document Parsing**: `pdf-parse`, `mammoth`

## Project Structure

```
├── .env.example
├── package.json
├── server.ts             # Express backend and RAG engine
├── src/
│   ├── App.tsx           # Main React interface
│   ├── index.css         # Tailwind directives
│   ├── main.tsx          # Client entrypoint
│   └── types.ts          # Shared TypeScript interfaces
```

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy `.env.example` to `.env` and configure your API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## Architecture & RAG Workflow

1. **Ingestion**: Documents are chunked (configurable size/overlap) and embedded.
2. **Retrieval**: User query is embedded and compared against the in-memory store via Cosine Similarity.
3. **Filtering**: Chunks below the similarity threshold are discarded.
4. **Generation**: Top-K chunks are injected into a strict system prompt emphasizing source fidelity.
5. **Verification**: The model is instructed to verify generated claims and output structured citations and follow-up questions.

## Trade-offs & Future Improvements

- **In-Memory Store**: Currently uses an in-memory array for vector search. For production scale (millions of chunks), integrate a dedicated Vector Database like Pinecone, Weaviate, or pgvector.
- **Chunking Strategy**: Currently uses naive character-based sliding windows. Future iterations could use semantic chunking or structural parsing (keeping paragraphs/sections intact).
- **Authentication**: No user auth is implemented. An enterprise deployment would require OAuth/SAML.

# ResearchPilot AI — Enterprise RAG Research Agent

An evidence-based AI research agent that answers questions **strictly from user-provided documents**, with inline citations, conflict detection, and full RAG pipeline visibility.

Built for the **ROOMAN AI Challenge** — Research Agent (with Citations) track.

---

## What It Does

> "My agent takes a question and a set of uploaded documents, retrieves the most relevant passages using vector search, and returns a grounded answer with inline citations — or clearly states when the sources don't contain the answer."

Upload PDFs, DOCX, or TXT files. Ask questions. Get cited answers backed by your documents.

---

## Features

- **Multi-format ingestion** — PDF, DOCX, TXT parsing
- **In-memory vector store** — chunk embedding + cosine similarity search
- **Grounded answers** — every factual claim cited with `(Source: filename.pdf, Page N)`
- **Conflict detection** — surfaces contradictions across documents with `⚠️ Conflicting Evidence Found`
- **Confidence scoring** — High / Medium / Low based on similarity score
- **"No answer" handling** — explicitly states when sources don't contain the answer
- **Pipeline visualiser** — live step-by-step: Parse → Chunk → Embed → Search → Top-K → Generate → Verify
- **Evidence panel** — expandable raw retrieved chunks with similarity scores
- **Export** — download session as Markdown or JSON
- **Configurable RAG** — tune Top-K, chunk size, overlap, threshold, temperature

---

## Technology Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Tailwind CSS v4, Vite 6 |
| Backend | Express 4, Node.js, TypeScript |
| AI — Generation | Google Gemini 2.5 Flash |
| AI — Embeddings | `gemini-embedding-exp-03-07` via Generative Language API |
| Document parsing | `pdf-parse` (v2), `mammoth` |
| Vector search | In-memory cosine similarity |

---

## Project Structure

```
researchpilot-ai/
├── server.ts          # Express backend + RAG engine
├── src/
│   ├── App.tsx        # React UI — chat, upload, search, settings
│   ├── types.ts       # Shared TypeScript interfaces
│   ├── main.tsx       # React entry point
│   └── index.css      # Tailwind directives
├── index.html         # HTML shell
├── vite.config.ts     # Vite + Tailwind config
├── tsconfig.json      # TypeScript config
├── .env.example       # Environment variable template
└── package.json
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- A Google Gemini API key from [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 1. Clone the repository

```bash
git clone https://github.com/R-Jashwanth/ResearchPilot-AI.git
cd ResearchPilot-AI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=AIzaSyYourKeyHere
```

Get your key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) — it should start with `AIzaSy`.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Use

1. **Upload documents** — drag and drop or click "Upload Documents" (PDF, DOCX, TXT)
2. **Wait for indexing** — the app chunks and embeds your documents automatically
3. **Ask a question** — type in the chat input and press Enter or Send
4. **Get a cited answer** — response includes inline citations, sources used, and follow-up questions
5. **Explore evidence** — click "View Retrieved Evidence" to see the raw chunks used

---

## RAG Pipeline

```
User uploads document
        ↓
   Parse text (pdf-parse / mammoth / fs)
        ↓
   Chunk text (sliding window, configurable size + overlap)
        ↓
   Embed each chunk (gemini-embedding-exp-03-07)
        ↓
   Store in in-memory vector store
        ↓
User asks question
        ↓
   Embed question
        ↓
   Cosine similarity against all chunks
        ↓
   Filter by similarity threshold, take Top-K
        ↓
   Inject chunks into strict system prompt
        ↓
   Gemini 2.5 Flash generates grounded answer
        ↓
   Cited answer streamed back to UI
```

---

## Sample Questions & Answers

**Input documents:** A research paper on machine learning + a technical report on neural networks

**Q: What optimisation algorithm does the paper recommend?**

```
# Answer
The paper recommends Adam optimiser for training deep neural networks due to its 
adaptive learning rate properties (Source: ml_paper.pdf, Page 4).

# Sources Used
- ml_paper.pdf (Pages 3, 4)

# Follow-up Questions
- What are the hyperparameter settings used with Adam in this paper?
- How does Adam compare to SGD in the reported experiments?
- What learning rate schedule is applied alongside Adam?
```

**Q: What is the capital of France?** *(not in documents)*

```
I could not find sufficient evidence in the uploaded documents to answer this question.
Reason: Similarity too low (0.08 < 0.2)
```

---

## Configurable Settings

Access via the **Settings** button in the sidebar:

| Parameter | Default | Description |
|---|---|---|
| Top-K | 5 | Number of chunks retrieved per query |
| Chunk Size | 1000 | Characters per chunk |
| Chunk Overlap | 200 | Overlap between consecutive chunks |
| Similarity Threshold | 0.2 | Minimum score to include a chunk |
| Temperature | 0.2 | Generation randomness (lower = more factual) |
| Max Tokens | 2048 | Maximum response length |

---

## Design Decisions & Tradeoffs

### What I chose and why

**Gemini 2.5 Flash** — Best balance of speed and reasoning quality for a 24-hour build. The strict system prompt does most of the heavy lifting for citation fidelity.

**`gemini-embedding-exp-03-07`** — Latest available embedding model from Google, better semantic understanding than older `text-embedding-004`.

**Direct fetch for embeddings** — The `@google/genai` SDK routes embedding calls through a different API path than generation calls. Using direct `fetch` against the REST API is more reliable and avoids SDK versioning issues.

**In-memory vector store** — Simple JS array with cosine similarity. Zero infrastructure, instant setup. Sufficient for demo-scale document sets (hundreds of chunks). Not suitable for production with millions of chunks — would need Pinecone, Weaviate, or pgvector.

**Character-based chunking** — Sliding window with configurable size and overlap. Fast and predictable. Doesn't respect sentence or paragraph boundaries, so a chunk can split mid-sentence. Semantic chunking would improve retrieval quality.

**React single-file frontend** — All UI in `App.tsx`. Appropriate for this scope; would need component splitting for a production codebase.

### Limitations

- **No persistence** — vector store lives in memory, lost on server restart
- **No authentication** — any user can clear the knowledge base
- **Brute-force search** — O(n) cosine similarity on every query; fine for small sets, slow at scale
- **`vectorDb` label in stats** says "FAISS (In-Memory HNSW)" — this is inaccurate, it's a plain JS array

### What I'd improve with more time

- Persistent vector store (pgvector or Qdrant)
- Semantic / sentence-aware chunking
- Multi-turn conversation memory
- User authentication and per-user document isolation
- Streaming upload progress indicator
- Re-ranking retrieved chunks before generation

---

## Build for Production

```bash
npm run build
npm start
```

---

## License

MIT

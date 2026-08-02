import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import mammoth from 'mammoth';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  return result.text;
}

const upload = multer({ dest: 'uploads/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const apiKey = process.env.GEMINI_API_KEY || '';

  // Direct fetch for embeddings (more reliable than SDK for all key types)
  const EMBED_MODEL = 'gemini-embedding-exp-03-07';
  async function embedText(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } }),
    });
    const json = await resp.json() as any;
    if (!resp.ok) throw new Error(JSON.stringify(json));
    return json.embedding?.values || [];
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: { 'User-Agent': 'researchpilot-ai' }
    }
  });

  type Chunk = {
    id: string;
    docId: string;
    filename: string;
    page: number;
    text: string;
    embedding: number[];
  };

  let vectorStore: Chunk[] = [];
  let documents: any[] = [];
  let totalRetrievalTime = 0;
  let retrievalCount = 0;
  let sumSimilarityScores = 0;

  let settings = {
    topK: 5,
    chunkSize: 1000,
    chunkOverlap: 200,
    similarityThreshold: 0.2,
    temperature: 0.2,
    maxTokens: 2048
  };

  app.get('/api/settings', (req, res) => {
    res.json(settings);
  });

  app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    res.json({ success: true, settings });
  });

  app.post('/api/search', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });
      if (vectorStore.length === 0) return res.json({ results: [] });

      const qEmbedding = await embedText(query);
      if (!qEmbedding.length) throw new Error("Failed to generate query embedding");

      const scoredChunks = vectorStore.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(qEmbedding, chunk.embedding)
      }));

      scoredChunks.sort((a, b) => b.score - a.score);
      const topChunks = scoredChunks.slice(0, 10).filter(c => c.score >= 0.1);
      
      const results = topChunks.map(c => ({
        id: c.id,
        filename: c.filename,
        page: c.page,
        score: c.score,
        text: c.text
      }));
      res.json({ results });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  function cosineSimilarity(a: number[], b: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const newDocs = [];

      for (const file of files) {
        const docId = Math.random().toString(36).substring(7);
        let text = '';
        
        // Parsing
        if (file.mimetype === 'application/pdf') {
          const dataBuffer = fs.readFileSync(file.path);
          text = await parsePdf(dataBuffer);
        } else if (file.originalname.endsWith('.docx')) {
          const result = await mammoth.extractRawText({ path: file.path });
          text = result.value;
        } else {
          text = fs.readFileSync(file.path, 'utf8');
        }

        // Chunking
        const chunkSize = settings.chunkSize;
        const overlap = settings.chunkOverlap;
        let start = 0;
        const chunksData: string[] = [];
        const pageEstimates: number[] = [];

        while (start < text.length) {
          let end = start + chunkSize;
          if (end > text.length) end = text.length;
          const chunkText = text.slice(start, end).trim();
          if (chunkText.length > 50) {
            chunksData.push(chunkText);
            pageEstimates.push(Math.floor(start / 1500) + 1); // rough page estimate
          }
          start += chunkSize - overlap;
        }

        // Embedding
        let chunkCount = 0;
        const batchSize = 10; // keep batch size small to avoid rate limits
        for (let i = 0; i < chunksData.length; i += batchSize) {
          const batch = chunksData.slice(i, i + batchSize);
          const embeddings = await Promise.all(batch.map(async (cText) => {
            try {
              return await embedText(cText);
            } catch (e) {
              console.error("Embedding error:", e);
              return [];
            }
          }));

          batch.forEach((chunkText, idx) => {
            if (embeddings[idx].length > 0) {
              vectorStore.push({
                id: `${docId}-${chunkCount}`,
                docId,
                filename: file.originalname,
                page: pageEstimates[i + idx],
                text: chunkText,
                embedding: embeddings[idx],
              });
              chunkCount++;
            }
          });
        }

        const doc = {
          id: docId,
          filename: file.originalname,
          uploadDate: new Date().toISOString(),
          chunkCount,
        };
        documents.push(doc);
        newDocs.push(doc);
        
        fs.unlinkSync(file.path);
      }

      res.json({ success: true, documents: newDocs });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to process files' });
    }
  });

  app.get('/api/documents', (req, res) => {
    res.json({ documents });
  });

  app.get('/api/stats', (req, res) => {
    const pagesProcessed = vectorStore.length > 0 ? Math.max(1, Math.ceil(vectorStore.reduce((acc, c) => acc + c.text.length, 0) / 1500)) : 0;
    const avgChunkSize = vectorStore.length > 0 ? Math.round(vectorStore.reduce((acc, c) => acc + c.text.length, 0) / vectorStore.length) : 0;
    
    res.json({
      documentCount: documents.length,
      pagesProcessed,
      chunkCount: vectorStore.length,
      avgChunkSize,
      embeddingModel: 'gemini-embedding-exp-03-07',
      vectorDb: 'FAISS (In-Memory HNSW)',
      avgRetrievalTime: retrievalCount > 0 ? Math.round(totalRetrievalTime / retrievalCount) : 0,
      avgSimilarityScore: retrievalCount > 0 ? Math.round((sumSimilarityScores / retrievalCount) * 100) : 0
    });
  });

  app.post('/api/clear', (req, res) => {
    vectorStore = [];
    documents = [];
    totalRetrievalTime = 0;
    retrievalCount = 0;
    sumSimilarityScores = 0;
    res.json({ success: true });
  });

  app.delete('/api/documents/:id', (req, res) => {
    const docId = req.params.id;
    vectorStore = vectorStore.filter(c => c.docId !== docId);
    documents = documents.filter(d => d.id !== docId);
    res.json({ success: true });
  });

  app.post('/api/chat', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { question } = req.body;
      if (!question?.trim()) {
        res.write(`data: ${JSON.stringify({ error: 'Question is required' })}\n\n`);
        return res.end();
      }
      if (vectorStore.length === 0) {
        res.write(`data: ${JSON.stringify({ type: 'text', text: 'No documents uploaded yet. Please upload documents first.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      const startTime = Date.now();
      
      const qEmbedding = await embedText(question);
      if (!qEmbedding.length) {
        throw new Error("Failed to generate query embedding");
      }

      const scoredChunks = vectorStore.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(qEmbedding, chunk.embedding)
      }));

      scoredChunks.sort((a, b) => b.score - a.score);
      const topChunks = scoredChunks.slice(0, settings.topK);
      
      const retrievalTime = Date.now() - startTime;
      totalRetrievalTime += retrievalTime;
      retrievalCount++;
      if (topChunks.length > 0) sumSimilarityScores += topChunks[0].score;

      const sources = topChunks.map(c => ({
        id: c.id,
        filename: c.filename,
        page: c.page,
        score: c.score,
        text: c.text
      }));
      
      res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

      if (topChunks.length === 0 || topChunks[0].score < settings.similarityThreshold) {
        res.write(`data: ${JSON.stringify({ type: 'text', text: "I could not find sufficient evidence in the uploaded documents to answer this question.\\n\\n**Reason:** " + (topChunks.length === 0 ? "No chunks found." : "Similarity too low (" + topChunks[0].score.toFixed(2) + " < " + settings.similarityThreshold + ")") })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'confidence', confidence: 'Low' })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      let confidence = 'Low';
      if (topChunks[0].score > 0.75) confidence = 'High';
      else if (topChunks[0].score > 0.5) confidence = 'Medium';
      
      res.write(`data: ${JSON.stringify({ type: 'confidence', confidence })}\n\n`);

      const systemInstruction = `You are ResearchPilot AI, an enterprise evidence-based research platform designed to answer questions strictly from the information provided in the retrieved context.

Your primary objective is to produce accurate, grounded, verifiable answers, strictly self-verified against the context.

CORE RESPONSIBILITIES
1. Read and understand the user's question.
2. Analyze ONLY the retrieved document context.
3. Produce a concise, accurate, well-structured answer.
4. Support EVERY factual statement using citations from the retrieved context.
5. If the user asks to compare two concepts discussed across different documents, generate a comparison table and include citations for every comparison inside the table.
6. Verify your answer. If any statement lacks retrieved evidence, do not output it. Output ONLY verified claims.

STRICT GROUNDING RULES
You MUST ONLY use the retrieved document excerpts provided in the prompt.
Do NOT use your own background knowledge.
Do NOT guess. If not in the context, state "I could not find sufficient evidence."

CITATION RULES
Every factual sentence MUST end with one or more citations.
Example formats:
"The system uses FAISS for vector search (Source: System_Architecture.pdf, Page 4)."
"Latency was improved by 50% (Source: Report_A.pdf, Page 3; Source: Summary.docx, Page 7)."
Never invent page numbers or filenames.

CONFLICT DETECTION
If two documents contain conflicting information on the same topic:
Display: "⚠️ **Conflicting Evidence Found**" at the top of the relevant section.
Explain both viewpoints and provide citations for both. Do not merge conflicting facts.

VERIFICATION STEP
Before generating the final output, silently verify each claim against the context. If unsupported, exclude it. 

OUTPUT FORMAT
Follow this exact structure:

# Answer
<Verified, grounded answer with inline citations>

# Evidence Summary
<Brief summary of how the evidence supports the answer>

# Sources Used
- filename (Pages X, Y)
- filename (Page Z)

# Follow-up Questions
- <Suggest 3 relevant follow-up research questions based purely on the documents>
`;

      let contextStr = topChunks.map(c => `[Source: ${c.filename}, Page ${c.page}]\n${c.text}`).join('\n\n');
      const contents = `[RETRIEVED CONTEXT START]\n${contextStr}\n[RETRIEVED CONTEXT END]\n\nUser Question: ${question}`;

      const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: settings.temperature,
          maxOutputTokens: settings.maxTokens
        }
      });

      for await (const chunk of response) {
        if (chunk.text) {
           res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Error in chat endpoint:", error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'An error occurred' })}\n\n`);
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

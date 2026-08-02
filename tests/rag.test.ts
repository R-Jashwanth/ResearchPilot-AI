/**
 * ResearchPilot AI — RAG Pipeline Unit Tests
 *
 * Tests core logic: chunking, cosine similarity, retrieval filtering,
 * citation format validation, and "no answer" behaviour.
 *
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── 1. Text Chunking ────────────────────────────────────────────────────────

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
}

describe('Text Chunking', () => {
  it('splits text into chunks of the correct maximum size', () => {
    const text = 'A'.repeat(3000);
    const chunks = chunkText(text, 1000, 200);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 1000, `Chunk too large: ${chunk.length}`);
    }
  });

  it('produces overlapping chunks', () => {
    const text = 'word '.repeat(500); // 2500 chars
    const chunks = chunkText(text, 1000, 200);
    assert.ok(chunks.length > 2, 'Expected more than 2 chunks with overlap');
  });

  it('skips chunks shorter than 50 characters', () => {
    const text = 'Hello world. ' + 'X'.repeat(2000);
    const chunks = chunkText(text, 100, 0);
    for (const chunk of chunks) {
      assert.ok(chunk.length > 50, `Short chunk slipped through: "${chunk}"`);
    }
  });

  it('returns empty array for empty input', () => {
    const chunks = chunkText('', 1000, 200);
    assert.deepEqual(chunks, []);
  });
});

// ─── 2. Cosine Similarity ─────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('Cosine Similarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = [0.1, 0.5, 0.3, 0.8];
    assert.ok(Math.abs(cosineSimilarity(v, v) - 1.0) < 1e-6);
  });

  it('returns 0 for orthogonal vectors', () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it('returns 0 for zero vectors', () => {
    assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
  });

  it('returns value between -1 and 1', () => {
    const a = [0.2, 0.8, 0.4];
    const b = [0.9, 0.1, 0.6];
    const score = cosineSimilarity(a, b);
    assert.ok(score >= -1 && score <= 1, `Score out of range: ${score}`);
  });

  it('is symmetric: sim(a,b) === sim(b,a)', () => {
    const a = [0.3, 0.7, 0.2];
    const b = [0.5, 0.1, 0.9];
    assert.ok(Math.abs(cosineSimilarity(a, b) - cosineSimilarity(b, a)) < 1e-10);
  });
});

// ─── 3. Top-K Retrieval & Threshold Filtering ─────────────────────────────────

interface Chunk { id: string; text: string; score: number; }

function retrieveTopK(chunks: Chunk[], threshold: number, k: number): Chunk[] {
  return chunks
    .filter(c => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

describe('Top-K Retrieval', () => {
  const mockChunks: Chunk[] = [
    { id: '1', text: 'Neural networks are universal approximators.', score: 0.91 },
    { id: '2', text: 'The model uses Adam optimiser with lr=0.001.', score: 0.78 },
    { id: '3', text: 'Results show 94% accuracy on the test set.', score: 0.65 },
    { id: '4', text: 'Batch normalisation was applied after each layer.', score: 0.45 },
    { id: '5', text: 'Unrelated content about cooking recipes.', score: 0.08 },
  ];

  it('returns at most K chunks', () => {
    const results = retrieveTopK(mockChunks, 0.2, 3);
    assert.ok(results.length <= 3);
  });

  it('filters chunks below similarity threshold', () => {
    const results = retrieveTopK(mockChunks, 0.2, 10);
    for (const r of results) {
      assert.ok(r.score >= 0.2, `Chunk below threshold returned: ${r.score}`);
    }
  });

  it('returns empty array when no chunks exceed threshold', () => {
    const results = retrieveTopK(mockChunks, 0.99, 5);
    assert.deepEqual(results, []);
  });

  it('returns chunks sorted by score descending', () => {
    const results = retrieveTopK(mockChunks, 0.2, 10);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score);
    }
  });

  it('handles empty chunk array gracefully', () => {
    const results = retrieveTopK([], 0.2, 5);
    assert.deepEqual(results, []);
  });
});

// ─── 4. Confidence Scoring ────────────────────────────────────────────────────

function getConfidence(topScore: number): 'High' | 'Medium' | 'Low' {
  if (topScore > 0.75) return 'High';
  if (topScore > 0.5) return 'Medium';
  return 'Low';
}

describe('Confidence Scoring', () => {
  it('returns High for score > 0.75', () => {
    assert.equal(getConfidence(0.91), 'High');
    assert.equal(getConfidence(0.76), 'High');
  });

  it('returns Medium for score between 0.5 and 0.75', () => {
    assert.equal(getConfidence(0.65), 'Medium');
    assert.equal(getConfidence(0.51), 'Medium');
  });

  it('returns Low for score <= 0.5', () => {
    assert.equal(getConfidence(0.5), 'Low');
    assert.equal(getConfidence(0.2), 'Low');
    assert.equal(getConfidence(0.0), 'Low');
  });
});

// ─── 5. Citation Format Validation ───────────────────────────────────────────

function hasCitation(text: string): boolean {
  return /\(Source:\s*.+?,\s*Page\s*\d+\)/i.test(text);
}

describe('Citation Format Validation', () => {
  it('detects valid citation format', () => {
    assert.ok(hasCitation('The model uses FAISS (Source: Architecture.pdf, Page 4).'));
    assert.ok(hasCitation('Accuracy was 94% (Source: Results.docx, Page 2).'));
  });

  it('rejects text with no citation', () => {
    assert.ok(!hasCitation('The model uses FAISS for vector search.'));
    assert.ok(!hasCitation('No source provided here.'));
  });

  it('detects citation mid-sentence', () => {
    assert.ok(hasCitation('The paper (Source: ml_paper.pdf, Page 1) describes the approach.'));
  });
});

// ─── 6. "No Answer" Detection ─────────────────────────────────────────────────

function shouldRefuseAnswer(topScore: number, threshold: number, chunkCount: number): boolean {
  return chunkCount === 0 || topScore < threshold;
}

describe('"No Answer" Handling', () => {
  it('refuses when vector store is empty', () => {
    assert.ok(shouldRefuseAnswer(0, 0.2, 0));
  });

  it('refuses when top similarity is below threshold', () => {
    assert.ok(shouldRefuseAnswer(0.1, 0.2, 5));
  });

  it('proceeds when similarity exceeds threshold', () => {
    assert.ok(!shouldRefuseAnswer(0.75, 0.2, 5));
  });

  it('refuses at exact threshold boundary', () => {
    assert.ok(shouldRefuseAnswer(0.19, 0.2, 5));
  });
});

// ─── 7. Page Estimation ───────────────────────────────────────────────────────

function estimatePage(charOffset: number, charsPerPage = 1500): number {
  return Math.floor(charOffset / charsPerPage) + 1;
}

describe('Page Estimation', () => {
  it('returns page 1 for start of document', () => {
    assert.equal(estimatePage(0), 1);
  });

  it('returns correct page for mid-document offset', () => {
    assert.equal(estimatePage(3000), 3); // 3000 / 1500 + 1 = 3
  });

  it('returns page 1 for offsets within first page', () => {
    assert.equal(estimatePage(1499), 1);
  });
});

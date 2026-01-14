// lib/selfCorrection.js
import { pipeline } from '@xenova/transformers';

const embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function norm(a) {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

function cosine(a, b) {
  const n = norm(a) * norm(b) + 1e-8;
  return dot(a, b) / n;
}

// Simple heuristic: measure average cosine similarity between question and retrieved chunks.
// If below threshold, suggest that correction (rephrase / web-search) may be needed.
export async function assessContextRelevance(question, contextChunks, { threshold = 0.30 } = {}) {
  if (!question || !contextChunks || contextChunks.length === 0) {
    return { needsCorrection: true, reason: 'no_context' };
  }

  const embedder = await embedderPromise;
  const qT = await embedder(question, { pooling: 'mean', normalize: true });
  const qEmb = Array.from(qT.data);

  let sum = 0;
  let count = 0;
  for (const c of contextChunks) {
    const text = typeof c === 'string' ? c : c.chunk_text || '';
    if (!text) continue;
    try {
      const t = await embedder(text, { pooling: 'mean', normalize: true });
      const emb = Array.from(t.data);
      const sim = cosine(qEmb, emb);
      sum += sim;
      count++;
    } catch (e) {
      // skip
    }
  }

  const avg = count === 0 ? 0 : sum / count;
  const needsCorrection = avg < threshold;
  return { needsCorrection, avgSimilarity: avg, threshold };
}

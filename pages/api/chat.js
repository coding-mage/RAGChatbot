// pages/api/chat.js

import { Pool } from 'pg';
import { getUserFromReq } from '../../lib/auth';
import { pipeline } from '@xenova/transformers'; // Local embedding model
import { getFaithfulnessScore } from '../../lib/faithfulness';
import { assessContextRelevance } from '../../lib/selfCorrection';
import supabaseServer from '../../lib/supabaseServer';

// ---------------- Supabase/Postgres setup ----------------

const pool = new Pool({
  connectionString: process.env.SUPABASE_SERVICE_ROLE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------- Local embedding setup ----------------

let embedderPromise = pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

// Convert JS array to Postgres vector literal
function toPgVector(arr) {
  return `[${arr.join(',')}]`;
}

// Get embedding from local model
async function getEmbedding(text) {
  const embedder = await embedderPromise;
  const tensor = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(tensor.data);
}

// ---------------- API handler ----------------

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Missing question' });

    // ---------------- Optional LLMs ----------------

    let gemini = null;
    if (process.env.GEMINI_API_KEY) {
      try {
        const mod = await import('@google/genai');
        const { GoogleGenAI } = mod;
        gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } catch (e) {
        console.warn(
          'Gemini SDK not available or failed to load; continuing without generation:',
          e.message
        );
        gemini = null;
      }
    }

    let openaiClient = null;
    if (!gemini && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = (await import('openai')).default;
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (e) {
        console.warn(
          'OpenAI SDK failed to load for fallback generation:',
          e.message
        );
        openaiClient = null;
      }
    }

    // ---------------- Embed question ----------------

    let queryEmbedding = await getEmbedding(question);
    if (queryEmbedding.length > 2000) {
      queryEmbedding = queryEmbedding.slice(0, 2000);
    }

    const pgVector = toPgVector(queryEmbedding);

    // ---------------- Vector search ----------------

    const vectorQuery = `
      SELECT
        c.id,
        c.chunk_text,
        c.document_id,
        d.file_name,
        d.storage_path
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE d.user_id = $1
      ORDER BY c.embedding <-> $2
      LIMIT 30
    `;

    const { rows } = await pool.query(vectorQuery, [user.id, pgVector]);

    const context = rows.map(r => r.chunk_text).join('\n\n');



const reranker = await pipeline(
  'text-classification',
  'Xenova/ms-marco-MiniLM-L-6-v2'
);

async function rerank(question, chunks) {
  const scored = await Promise.all(
    chunks.map(async c => {
      const out = await reranker(`${question} [SEP] ${c.chunk_text}`);
      return { ...c, score: out[0].score };
    })
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}


    // ---------------- Self-correction ----------------

    const relevance = await assessContextRelevance(question, rows);

    let trace = {
      initialSimilarity: relevance.avgSimilarity,
      needsCorrection: relevance.needsCorrection,
    };

    let rephrased = null;
    let finalRows = rows;

    if (relevance.needsCorrection) {
      trace.note = 'Low question-context similarity';

      if (gemini) {
        try {
          const rephrasePrompt = `
Rewrite the question into a SHORT factual search query.

Rules:
- Output ONE line only
- No explanations
- No examples
- No markdown
- No assumptions
- Preserve all names exactly
- Do NOT add new information
- Do NOT ask the user for clarification

Question:
${question}
          `;

          const repResp = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: rephrasePrompt,
          });

          if (repResp.candidates?.length) {
            const rep = repResp.candidates[0];
            if (Array.isArray(rep.content)) {
              rephrased = rep.content.map(p => p.text || '').join('');
            } else if (rep.content?.parts?.[0]?.text) {
              rephrased = rep.content.parts[0].text;
            }
          }
        } catch (e) {
          console.warn('Rephrase failed', e);
        }
      }

      if (rephrased) {
        const newEmbedding = await getEmbedding(rephrased);
        const pgVector2 = toPgVector(
          newEmbedding.length > 2000
            ? newEmbedding.slice(0, 2000)
            : newEmbedding
        );

        const { rows: newRows } = await pool.query(
          vectorQuery,
          [user.id, pgVector2]
        );

        finalRows = newRows.length ? newRows : rows;
        trace.rephrasedQuestion = rephrased;
        trace.retrievalUsed = 'rephrase';
      } else {
        // Web search fallback removed — keep original retrieval
        trace.retrievalUsed = 'original';
      }
    }

    // ---------------- Generation ----------------

    const finalContext = finalRows.map(r => r.chunk_text).join('\n\n');

    let answer = "Sorry, couldn't generate an answer.";

    const generationPrompt = `
Answer using ONLY the context below.
If the answer is not in the context, say you don't know.

Context:
${finalContext}

Question:
${question}
    `;

    if (gemini) {
      try {
        const genResp = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: generationPrompt,
        });

        if (genResp.candidates?.length) {
          const candidate = genResp.candidates[0];
          if (Array.isArray(candidate.content)) {
            answer = candidate.content.map(i => i.text || '').join('');
          } else if (candidate.content?.parts?.[0]?.text) {
            answer = candidate.content.parts[0].text;
          }
        }
      } catch (e) {
        console.error('Generation error (Gemini):', e);
      }
    } else if (openaiClient) {
      try {
        const resp = await openaiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that answers using ONLY the provided context.',
            },
            { role: 'user', content: generationPrompt },
          ],
          max_tokens: 300,
        });

        answer = resp.choices?.[0]?.message?.content || answer;
      } catch (e) {
        console.error('Generation error (OpenAI fallback):', e);
      }
    }

    // ---------------- Faithfulness ----------------

    const faith = await getFaithfulnessScore(finalRows, answer, { topK: 3 });

    // ---------------- Sources ----------------

    const sourcesBase =
      finalRows && finalRows.length ? finalRows : rows || [];

    const responseSources = await Promise.all(
      sourcesBase.map(async r => {
        const out = { ...r };
        try {
          if (r.storage_path) {
            const { data } = await supabaseServer.storage
              .from('documents')
              .createSignedUrl(r.storage_path, 60);
            if (data?.signedUrl) out.signed_url = data.signedUrl;
          }
        } catch {}
        return out;
      })
    );

    // ---------------- Response ----------------

    res.json({
      answer,
      sources: responseSources || [],
      faithfulness: faith.score,
      faithfulnessDetail: faith.perChunk,
      selfCorrection: trace,
    });

  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({ error: err.message });
  }
}

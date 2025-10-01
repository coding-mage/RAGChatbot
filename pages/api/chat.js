// pages/api/chat.js
import { Pool } from 'pg';
import { getUserFromReq } from '../../lib/auth';
import { pipeline } from '@xenova/transformers'; // Local embedding model
import { GoogleGenAI } from '@google/genai';

// ---------------- Gemini client ----------------
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------------- Supabase/Postgres setup ----------------
const pool = new Pool({
  connectionString: process.env.SUPABASE_SERVICE_ROLE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------- Local embedding setup ----------------
let embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// Convert JS array to Postgres vector literal
function toPgVector(arr) {
  return `[${arr.join(',')}]`;
}

// Get embedding from local model
async function getEmbedding(text) {
  const embedder = await embedderPromise;
  const tensor = await embedder(text, { pooling: 'mean', normalize: true });
  // tensor.data is Float32Array
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

    // 1️⃣ Embed the question using local model
    let queryEmbedding = await getEmbedding(question);

    // 2️⃣ Truncate to max 2000 dims for Supabase IVFFlat
    if (queryEmbedding.length > 2000) {
      queryEmbedding = queryEmbedding.slice(0, 2000);
    }
    const pgVector = toPgVector(queryEmbedding);

    // 3️⃣ Vector search in Supabase
    const vectorQuery = `
      SELECT id, chunk_text
      FROM chunks
      WHERE document_id IN (
        SELECT id FROM documents WHERE user_id = $1
      )
      ORDER BY embedding <-> $2
      LIMIT 6
    `;
    const { rows } = await pool.query(vectorQuery, [user.id, pgVector]);
    const context = rows.map(r => r.chunk_text).join('\n\n');

    // 4️⃣ Generate answer using Gemini
    // 4️⃣ Generate answer using Gemini
const prompt = `Answer using ONLY the context below.Please generate a response of a single paragraph. If the answer is not in the context, say you don't know.\n\nContext:\n${context}\n\nQuestion: ${question}`;

const genResp = await gemini.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
});
console.log(prompt)
// Extract answer text safely
let answer = "Sorry, couldn't generate an answer.";

if (genResp.candidates?.length) {
  const candidate = genResp.candidates[0];
  console.log(candidate.content)
  if (Array.isArray(candidate.content)) {
    // content is array of objects { type: 'output_text', text: '...' }
    answer = candidate.content.map(item => item.text || '').join('');
  } else if (candidate.content?.parts[0].text) {
    // single object with text
    answer = candidate.content.parts[0].text;
  }
}

res.json({ answer, sources: rows || [] });


    // Extract answer text from Gemini response
    // const answer = genResp.candidates
    //   ?.map(c => c.content?.map(item => item.text).join('') || '')
    //   .join('\n') || "Sorry, couldn't generate an answer.";

    // res.json({ answer, sources: rows || [] });

  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({ error: err.message });
  }
}

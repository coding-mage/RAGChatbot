import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import pdf from "pdf-parse";
import IORedis from "ioredis";
import { Worker, Queue } from "bullmq";
import { pipeline } from "@xenova/transformers";
import { createClient } from "@supabase/supabase-js";

// ---------------- Supabase ----------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------------- Redis ----------------
const connection = new IORedis(process.env.REDIS_URL, {
  tls: {},
  maxRetriesPerRequest: null,
});

// ---------------- Clean text ----------------
function cleanText(text) {
  return text
    .replace(/\0/g, "") // remove null bytes
    .replace(/[\u0001-\u001F]/g, "") // remove other control chars
    .trim();
}

// ---------------- Load embedding model ----------------
console.log("Loading embedding model...");
const embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

// ---------------- Worker ----------------
const worker = new Worker(
  "pdf-processing",
  async (job) => {
    const embedder = await embedderPromise;

    const { filePath, documentId } = job.data;
    if (!filePath || !fs.existsSync(filePath)) {
      console.error("❌ File not found:", filePath);
      return;
    }

    console.log("📄 Processing PDF:", filePath);
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    // Split into paragraphs
    const rawChunks = pdfData.text.split("\n\n").filter((t) => t.trim().length > 0);

    for (const rawChunk of rawChunks) {
      try {
        const chunk = cleanText(rawChunk);
        if (!chunk) continue; // skip empty chunks

        // Generate embedding
        const embeddingResult = await embedder(chunk, { pooling: "mean", normalize: true });
        console.log(embeddingResult);
        const vector = Array.from(embeddingResult.data);
        console.log({
          document_id: documentId,
          chunk_text: chunk,
          embedding: vector,
          token_count: chunk.split(" ").length,
        });
        // Insert into Supabase
        const { error } = await supabase.from("chunks").insert({
          document_id: documentId,
          chunk_text: chunk,
          embedding: vector,
          token_count: chunk.split(" ").length,
        });

        if (error) console.error("❌ Insert error:", error);
      } catch (err) {
        console.error("❌ Embedding error:", err);
      }
    }

    console.log(`✅ Finished processing ${filePath}`);
  },
  { connection }
);

// ---------------- Optional: enqueue test ----------------
// const fileQueue = new Queue("pdf-processing", { connection });
// fileQueue.add("process-pdf", { filePath: "sample.pdf", documentId: "your-doc-id" });

console.log("Worker started, waiting for jobs...");

# RAGChatbot

An experimental Retrieval-Augmented Generation (RAG) chatbot built with Next.js, Supabase storage/Postgres (with vector embeddings), a local embedding pipeline, Google Gemini (GenAI) as the LLM, and a background worker that chunks and indexes uploaded documents.

This repository is a starter for building a private, user-scoped RAG system that stores user documents in Supabase storage, creates embeddings (locally via Xenova), indexes them in Postgres, and answers user questions by retrieving relevant chunks and asking Gemini for a grounded response.

## Key features

- Upload PDFs (via `pages/api/upload.js`) and store them in Supabase storage.
- Background worker (`worker.js`) parses PDFs, chunks text, and creates embeddings using a local Xenova model.
- Store document metadata in a `documents` table and chunk embeddings in a `chunks` table in Supabase/Postgres.
- Vector search via Postgres <-> operator to retrieve relevant context for a user's question (`pages/api/chat.js`).
- Generation performed with Google Gemini (via `@google/genai`) while instructing the model to answer only from context.
- Auth helpers using JWT cookies are in `lib/auth.js`.

## Repository layout (important files)

- `app/` - Next.js app routes and UI (React + app directory).
- `components/FileUploader.jsx` - client-side file upload component.
- `pages/api/upload.js` - API route to receive uploads, store files and queue worker jobs.
- `pages/api/chat.js` - API route that performs vector search and calls Gemini to answer.
- `lib/` - helper libraries (Supabase clients, auth, chunker, GenAI wrapper).
- `worker.js` - background PDF-processing worker that extracts text and stores embeddings.
- `test/`, `data/` - sample/test artifacts.

## Quick contract (inputs / outputs)

- Inputs: user uploads (PDFs), user question text (POST /api/chat).
- Outputs: stored document metadata, chunked embeddings in DB, and a JSON reply with an `answer` string and `sources` array from `/api/chat`.
- Error modes: Missing env vars, unauthorized requests, or failure to connect to Supabase/Redis will return 4xx/5xx responses.

## Prerequisites

- Node.js 18+ (recommended) and npm/yarn/pnpm.
- A Supabase project (Postgres + Storage). Create a `documents` storage bucket and the DB tables described below.
- Redis instance (for BullMQ job queue). A hosted Redis or local Redis is fine.
- Google Cloud (Gemini) API key with access to the GenAI SDK.

## Environment variables

Create a `.env.local` (or set environment variables in your deployment) with at least the following:

- NEXT_PUBLIC_SUPABASE_URL - your Supabase URL (public)
- NEXT_PUBLIC_SUPABASE_ANON_KEY - your Supabase anon key (public)
- SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (server-only)
- SUPABASE_SERVICE_ROLE_URL - Postgres connection string used by some server code (e.g. postgres://...)
- SUPABASE_URL - same as above used by worker (optional if you supply NEXT_PUBLIC_SUPABASE_URL)
- GEMINI_API_KEY - Google GenAI / Gemini API key
- REDIS_URL - URL for Redis used by BullMQ (e.g. redis://:password@host:port)
- JWT_SECRET - secret used to sign JWT cookies

Notes:
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` private — do not expose them to the browser.
- In this repo some server files read `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; ensure both are set.

## Database schema (expected tables)

This project expects at least two simple tables. Adjust types to your Supabase/Postgres setup.

- `documents`:
  - `id` (uuid or serial)
  - `user_id` (references your user id)
  - `file_name` (text)
  - `storage_path` (text)
  - `created_at` (timestamp)

- `chunks`:
  - `id`
  - `document_id` (foreign key -> documents.id)
  - `chunk_text` (text)
  - `embedding` (vector/float[]) — depends on your vector extension (or store as float[])
  - `token_count` (int)

Note: The repo currently uses basic Postgres vector search with a <-> operator; if you use pgvector or Supabase Vector Index you should adapt the column types accordingly.

## Install and run locally

1. Install dependencies

```bash
# using npm
npm install

# or using yarn
yarn
```

2. Create `.env.local` based on the environment variables above.

3. Start the Next.js development server

```bash
npm run dev
# or
yarn dev
```

By default Next.js runs on port 3000.

Open the UI in your browser:
Main app: http://localhost:3000
Important UI routes
/ — root (app/page.tsx)
/login — login page (login.js)
/register — register page (register.js)
/dashboard — authenticated dashboard (dashboard.js)
To use upload/chat features, sign up via /register, log in via /login (the app uses JWT cookies, see auth.js), then visit /dashboard.



4. Start the worker (in a separate terminal). The worker requires the same env vars plus `REDIS_URL`.

```bash
# Run the worker with node
node worker.js

# If you prefer: use nodemon for automatic reloads during development
npx nodemon worker.js
```

5. (Optional) Start a local Redis if you don't have a hosted one. On macOS with Homebrew:

```bash
brew install redis
redis-server /usr/local/etc/redis.conf
```

## Upload flow & background processing

- Client uploads a PDF via `components/FileUploader.jsx` which posts to `pages/api/upload.js`.
- The API stores the file in Supabase Storage and inserts a `documents` row.
- A BullMQ job is queued using Redis. The `worker.js` listens on the `pdf-processing` queue.
- The worker reads the PDF, extracts text, splits into chunks, computes embeddings with a local model (`@xenova/transformers`) and inserts `chunks` rows with the vector data.

## Asking questions (chat)

- The client calls `/api/chat` (POST) with `{ question }`.
- The API authenticates the user via JWT cookie (`lib/auth.js`).
- A local embedding is computed for the query and used to run a vector similarity search against the `chunks` table.
- The top chunks are concatenated and sent to Gemini with instructions to answer using ONLY the provided context.

Example response JSON:

```json
{
  "answer": "...",
  "sources": [ { "id": 123, "chunk_text": "..." }, ... ]
}
```

## Notes & gotchas

- Local embedding model: this project uses `@xenova/transformers` and a model id like `Xenova/all-MiniLM-L6-v2`. That library may require extra native/binary dependencies or a Node.js environment that supports WASM; consult the package docs.
- Gemini SDK: the code uses `@google/genai` and expects `GEMINI_API_KEY` to be set. SDK responses may return different shapes — the code contains logic to extract text from candidate content arrays.
- Postgres connection: some code uses `SUPABASE_SERVICE_ROLE_URL` (a full Postgres connection string). Ensure you have a connection string that allows queries from server-side code.
- Secure your keys: never expose service role keys in client-side code. Only use anon keys on the browser.
- Redis is used as the job queue backend (message broker) for background PDF processing via BullMQ.


## Deploy

- You can deploy the Next.js app to Vercel or any Node hosting that supports Next.js.
- The worker must run separately (e.g. on a small compute instance, Fly, Railway, or a background worker service) with access to Redis and Supabase service role key.





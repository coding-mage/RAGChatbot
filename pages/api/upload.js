// pages/api/upload.js
import formidable from 'formidable';
import fs from 'fs';
import supabaseServer from '../../lib/supabaseServer';
import { getUserFromReq } from '../../lib/auth';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const config = {
  api: { bodyParser: false }, // Disable Next.js body parsing
};

// Redis + BullMQ setup
const connection = new IORedis(process.env.REDIS_URL, { tls: {}, maxRetriesPerRequest: null });
const queue = new Queue("pdf-processing", { connection });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1️⃣ Authenticate user
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // 2️⃣ Parse files using formidable
  const form = formidable({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const uploadedFiles = Array.isArray(files.file) ? files.file : [files.file];
    const results = [];

    for (const file of uploadedFiles) {
      try {
        // 3️⃣ Read file content
        const fileContent = fs.readFileSync(file.filepath);

        // 4️⃣ Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabaseServer.storage
          .from('documents')
          .upload(`uploads/${Date.now()}_${file.originalFilename}`, fileContent);

        if (storageError) throw new Error(storageError.message);

        // 5️⃣ Insert metadata in DB
        const { data: docData, error: dbError } = await supabaseServer
          .from('documents')
          .insert({
            user_id: user.id,
            file_name: file.originalFilename,
            storage_path: storageData.path,
          })
          .select()
          .single();

        if (dbError) throw new Error(dbError.message);

        // 6️⃣ Queue job for worker 🚀
        await queue.add("pdf-job", {
          filePath: file.filepath,   // local temp path
          documentId: docData.id,    // link chunks to this doc
          userId: user.id,
        });

        results.push({
          fileName: file.originalFilename,
          documentId: docData.id,
          storagePath: storageData.path,
          queued: true,
        });
      } catch (uploadErr) {
        results.push({ fileName: file.originalFilename, error: uploadErr.message });
      }
    }

    res.status(200).json({ success: true, files: results });
  });
}

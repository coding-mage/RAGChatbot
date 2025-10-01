// components/FileUploader.jsx
import supabase from '../lib/supabaseClient';

export default function FileUploader({ token }) {
  async function handleFile(e) {
    const file = e.target.files[0];
    const filePath = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: false });
    if (error) return alert(error.message);

    // notify server to create doc row + enqueue
    await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    alert('Uploaded & queued');
  }

  return <input type="file" accept="application/pdf" onChange={handleFile} />;
}

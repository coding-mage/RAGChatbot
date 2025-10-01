// lib/chunker.js
export function chunkText(text, { chunkSize = 1800, overlap = 200 } = {}) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length + s.length <= chunkSize) {
      cur += (cur ? ' ' : '') + s;
    } else {
      if (cur) chunks.push(cur.trim());
      cur = s.slice(-Math.min(overlap, s.length)) + ' ' + s;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

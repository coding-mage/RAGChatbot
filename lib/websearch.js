// lib/websearch.js
// Minimal websearch adapter: prefer a search API (SERPAPI) if configured.
// For open-source-first mode this is a stub that returns an empty array unless SERPAPI_KEY is provided.

export async function webSearch(query, { dutchOnly = false, maxResults = 5 } = {}) {
  // If user provided SERPAPI_KEY as env var, one could implement a real call here.
  // For now, return an empty array as a safe fallback and to keep everything local/OSS.
  // Implementors can add SerpAPI, Bing, or Google CSE here.
  console.log('webSearch called (stub) — query=', query, 'dutchOnly=', dutchOnly);
  return [];
}

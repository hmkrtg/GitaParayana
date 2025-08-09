// Netlify Functions use Node 18+ (global fetch available)
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }
  try {
    const { chapter, verse, slok, transliteration, meaning } =
      JSON.parse(event.body || '{}');
    if (!chapter || !verse || !slok || !meaning) {
      return json({ error: 'Missing fields' }, 400);
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json({ error: 'Missing GEMINI_API_KEY' }, 500);

    const prompt = `Write 3–4 plain-English lines of neutral CONTEXT for this Bhagavad Gita verse. Avoid sectarian doctrine; no speculation. If uncertain, say "Context not certain."
Include who is speaking, to whom, and what's happening.

Verse (Sanskrit): ${slok}
Transliteration: ${transliteration || '(omitted)'}
Simple meaning: ${meaning}
Chapter: ${chapter}, Verse: ${verse}`;

       const resp = await fetch(
       'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
       {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           contents: [{ role: 'user', parts: [{ text: prompt }]}]
         })
       }
     );

     if (!resp.ok) {
       const txt = await resp.text();
       return json({ error: `Gemini HTTP ${resp.status}: ${txt}` }, resp.status);
     }

     const data = await resp.json();
     const context =
       data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
       'Context not available.';
     return json({ context }, 200);
   } catch (e) {
     return json({ error: e.message || 'Server error' }, 500);
   }
 };

 function json(obj, status = 200) {
   return { statusCode: status, headers: corsHeaders(), body: JSON.stringify(obj) };
 }
 function corsHeaders() {
   return {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'POST,OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type',
     'Cache-Control': 'public, max-age=86400'
   };
 }
 ```

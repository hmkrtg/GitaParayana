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

    const prompt =

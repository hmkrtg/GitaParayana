// netlify/functions/gitaContext.js
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors() };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { chapter, verse, slok, transliteration, meaning } = body;
    if (!chapter || !verse || !slok || !meaning) {
      return json({ error: "Missing fields" }, 400);
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return json({ error: "Missing OPENROUTER_API_KEY" }, 500);

    const textParts = [
      'Write 5–6 plain English lines of CONTEXT for this Bhagavad Gita verse, as if you\'re narrating to the audience what is happening.',
      'Use very dramatic but simple language. We\'re narrating a great mythological story; no speculation. If uncertain, say "Context not certain."',
      "Include who is speaking, to whom, and what's happening.",
      "",
      "Verse (Sanskrit): " + slok,
      "Transliteration: " + (transliteration || "(omitted)"),
      "Simple meaning: " + meaning,
      "Chapter: " + chapter + ", Verse: " + verse,
    ];
    const prompt = textParts.join("\n");

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        // optional but recommended:
        "HTTP-Referer": "https://your-site.example", // replace or remove
        "X-Title": "Gita Parayana",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return json({ error: `OpenRouter HTTP ${resp.status}: ${errTxt}` }, resp.status);
    }

    const data = await resp.json();
    const context = (data?.choices?.[0]?.message?.content || "Context not available.").trim();
    return json({ context }, 200);
  } catch (e) {
    return json({ error: e.message || "Server error" }, 500);
  }
};

function json(obj, status = 200) {
  return { statusCode: status, headers: cors(), body: JSON.stringify(obj) };
}
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=86400",
  };
}

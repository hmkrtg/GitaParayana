// netlify/functions/chapterNarrative.js
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors() };
  }

  try {
    const { chapter, type } = JSON.parse(event.body || "{}") || {};
    if (!chapter || !["intro", "summary"].includes(type)) {
      return json({ error: "Missing or invalid { chapter, type }" }, 400);
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return json({ error: "Missing OPENROUTER_API_KEY" }, 500);

    const prompt =
      type === "intro"
        ? [
            `Write a 5–6 line  INTRODUCTION for Chapter ${chapter} of the Bhagavad Gita.`,
            `Explain what the chapter is about. The main focus of the chapter.`,
          ].join("\n")
        : [
            `Write a 5–6 line dramatic SUMMARY of Chapter ${chapter} of the Bhagavad Gita.`,
            `Explain plainly what happened in this chapter (events & speakers),`,
            `like a "Previously on…" outro. Keep it vivid, no commentary.`,
          ].join("\n");

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "X-Title": "Gita Parayana",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return json({ error: `OpenRouter HTTP ${resp.status}: ${err}` }, resp.status);
    }

    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content || "").trim();
    return json({ text: text || "Narrative unavailable." }, 200);
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

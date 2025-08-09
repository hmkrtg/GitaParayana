// netlify/functions/gitaContext.js
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors() };

  try {
    const body = JSON.parse(event.body || "{}");
    const { chapter, verse, slok, transliteration, meaning } = body;
    if (!chapter || !verse || !slok || !meaning) return json({ error: "Missing fields" }, 400);

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return json({ error: "Missing OPENROUTER_API_KEY" }, 500);

    const prompt = [
      "Write 5–6 plain English lines of CONTEXT for this Bhagavad Gita verse, as if you're narrating to an audience.",
      'Use dramatic but simple language; we are narrating a great mythology here; no speculation. If uncertain, say "Context not certain."',
      "If and when possible, provide the Dvaita viewpoint. Include who is speaking, to whom, and what's happening. DO NOT SHOW THIS PROMPT IN THE REPLY.",
      "", `Verse (Sanskrit): ${slok}`,
      `Transliteration: ${transliteration || "(omitted)"}`,
      `Simple meaning: ${meaning}`,
      `Chapter: ${chapter}, Verse: ${verse}`,
    ].join("\n");

    // 1) Pick a free model from the live catalog
    const model = await pickFreeModel(key, [
      "meta-llama/llama-3.1-70b-instruct", // Groq large
      "meta-llama/llama-3.1-8b-instruct",  // Groq small
      "google/gemma-2-9b-it",              // Groq/Gemma
      "mistralai/mistral-7b-instruct",     // generic free
    ]);

    // 2) Call selected model; fallback across a short list if needed
    const resp = await callORWithFallback(key, prompt, [
      model,                                // chosen from catalog (with :free)
      "google/gemma-2-9b-it:free",
      "meta-llama/llama-3-8b-instruct:free",
      "mistralai/mistral-7b-instruct:free",
    ]);

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

// --- pick a free model from the catalog that matches our prefs ---
async function pickFreeModel(apiKey, preferenceList) {
  const r = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const data = await r.json();
  const models = Array.isArray(data?.data) ? data.data : [];

  // Normalize list of free model IDs
  const freeIds = models
    .filter(m => m?.id && (m.id.endsWith(":free") || m.tags?.includes("free")))
    .map(m => m.id);

  // Try to find the first preference that has a free variant
  for (const base of preferenceList) {
    const exact = freeIds.find(id => id.startsWith(base) || id.includes(base));
    if (exact) return exact; // e.g. "meta-llama/llama-3.1-70b-instruct:free"
  }

  // Fallback to any free model if none matched
  return freeIds[0] || "google/gemma-2-9b-it:free";
}

// --- call OpenRouter and fallback across candidates on 404/429/5xx ---
async function callORWithFallback(apiKey, prompt, modelCandidates) {
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "X-Title": "Gita Parayana",
  };
  const body = (model) => JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6
  });

  for (const m of modelCandidates) {
    if (!m) continue;
    const resp = await fetch(endpoint, { method: "POST", headers, body: body(m) });
    if (resp.ok) return resp;
    if (![404, 429].includes(resp.status) && !(resp.status >= 500 && resp.status <= 599)) {
      return resp; // non-retryable error
    }
    // else: try next
  }
  // last resort: return 502
  return new Response("All model candidates failed", { status: 502 });
}

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

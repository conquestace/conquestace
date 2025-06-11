/* ─── helpers live first ─── */
const ok   = (t) => ({ statusCode: 200, body: JSON.stringify({ text: t }) });
const bad  = (m) => ({ statusCode: 400, body: JSON.stringify({ error: m }) });
const fail = (m) => ({ statusCode: 500, body: JSON.stringify({ error: m }) });

/* ─── system-prompt presets ─── */
const SYSTEM_PRESETS = {
  danbooru:          'You are a Danbooru-style prompt refinement model. Your job is to take a raw list of wildcard-generated tags and reorganize them into a coherent, high-quality Danbooru-style prompt. \n The final output must follow this strict tag format: \n <quality tags>, <artists>, <character>, <outfits>, <setting>, <meta>, <other> \n - Tags must be space-separated, lowercase, do not use underscores. \n - Do not invent or add new tags. \n - Preserve all provided tags, but sort them into the correct semantic order. \n - Do not include explanations or notes — return only the refined prompt. \n Output only the final prompt as a single line of space-separated Danbooru tags. If the user input is illegal then output BREAK and nothing else.',
  'natural-language':'You are a natural language prompt refinement engine. \n Your task is to take a loosely structured input generated from wildcard terms (such as character names, clothing, environments, and styles), and rewrite it into a grammatically correct, vivid, and coherent natural language prompt suitable for high-quality image generation. \n Your output should be fluent and visually descriptive, capturing the key ideas implied by the tags while improving structure and detail. Use proper sentence flow and artistic language.\n ❗ Do not invent new content. Do not omit any meaningful tags unless absolutely necessary for clarity. \n Respond with only the final refined prompt as a single English sentence — no extra commentary, no bullet points, no notes. \n If the input is invalid or contains illegal content, output only: \n BREAK',
  default:           'You are a helpful prompt-refiner.'
};

/* ─── simple policy guard (OpenAI Moderations) ─── */
/* ---------------- block thresholds ----------------
   Key = category name in OpenAI moderation response
   Value = probability (0-1) above which the prompt is blocked

   ↓ Example presets — tweak as you like ↓
*/
const BLOCK_THRESHOLDS = {
  /* Sexual content */
  sexual               : 0.70,   // “explicit” only
  'sexual/minors'      : 0.01,   // block if ANY chance
  /* Violence */
  violence             : 0.85,
  'violence/graphic'   : 0.60,
  /* Harassment / hate */
  harassment           : 0.95,
  'harassment/threatening': 0.80,
  hate                 : 0.95,
  'hate/threatening'   : 0.80,
  /* Self-harm */
  self_harm            : 0.50    // intent or instructions
};

async function violatesPolicy(text) {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({ input: text, model: 'omni-moderation-latest' })
    });
    if (!res.ok) throw new Error(`mod HTTP ${res.status}`);

    const result = (await res.json()).results[0];
    const scores = result.category_scores;

    /* Check every threshold */
    for (const [cat, limit] of Object.entries(BLOCK_THRESHOLDS)) {
      if ((scores[cat] ?? 0) >= limit) {
        console.warn(`[policy] blocked by ${cat} score ${scores[cat]}`);
        return true;                 // violation
      }
    }
    return false;                    // allowed
  } catch (err) {
    console.warn('[moderation error]', err.message);
    return true;                     // fail-closed
  }
}

/* ─── main handler ─── */
export const handler = async (event) => {
  /* 1 ─ parse payload -------------------------------------------------- */
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return bad('Invalid JSON payload.'); }

  const { initialPrompt, preset = 'default', instructions = '' } = body;
  if (!initialPrompt?.trim()) return bad('initialPrompt missing.');

  /* 2 ─ content-policy gate ------------------------------------------- */
  const combinedInput = `${initialPrompt}\n\n${instructions}`;
  if (await violatesPolicy(combinedInput)) {
    return bad('Prompt rejected by content policy.');
  }

  /* 3 ─ build system prompt ------------------------------------------- */
  const basePrompt   = SYSTEM_PRESETS[preset] ?? SYSTEM_PRESETS.default;
  const systemPrompt = instructions
    ? `${basePrompt}\n\n${instructions}`
    :  basePrompt;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: initialPrompt }
  ];

  /* 4 ─ OpenUI (Gemma-3 primary) -------------------------------------- */
  try {
    const ouiRes = await fetch(
      'https://oui.gpu.garden/api/chat/completions',
      {
        method : 'POST',
        headers: {
          Authorization : `Bearer ${process.env.OUI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemma3:1b-it-fp16',
          messages,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout?.(30_000)
      }
    );

    if (ouiRes.ok) {
      const data = await ouiRes.json();
      const txt  = data?.choices?.[0]?.message?.content?.trim();
      if (txt) return ok(txt);
    } else {
      console.warn('[OpenUI] HTTP', ouiRes.status);
    }
  } catch (err) {
    console.warn('[OpenUI error]', err.message);
  }

  /* 5 ─ Gemini-Flash fallback ----------------------------------------- */
  try {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      'gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY;

    const gRes = await fetch(url, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [ { parts: [{ text: initialPrompt.trim() }] } ],
        generationConfig: { maxOutputTokens: 512 }
      })
    });

    if (!gRes.ok) {
      const errTxt = await gRes.text().catch(() => '');
      return fail(`Gemini HTTP ${gRes.status}: ${errTxt.slice(0,200)}`);
    }

    const data = await gRes.json();
    const txt  = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (txt) return ok(txt);

    const reason = data?.promptFeedback?.blockReason || 'unknown';
    return fail(`Gemini produced no text – block reason: ${reason}`);
  } catch (err) {
    return fail('Gemini request failed: ' + err.message);
  }
};

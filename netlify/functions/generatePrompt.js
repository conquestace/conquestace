/* ─── helpers live first ─── */
const ok   = (t) => ({ statusCode: 200, body: JSON.stringify({ text: t }) });
const bad  = (m) => ({ statusCode: 400, body: JSON.stringify({ error: m }) });
const fail = (m) => ({ statusCode: 500, body: JSON.stringify({ error: m }) });

/* ─── system-prompt presets ─── */
import SYSTEM_PRESETS from './systemPrompts.json' with { type: 'json' };

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

async function violatesPolicy(text, openaiKey) {
  if (!openaiKey) return false;       // no key → skip moderation
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
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

  const {
    initialPrompt,
    systemPrompt,
    preset = 'default',
    extraInstructions = '',
    insert = 'after',
    llm = {},
    geminiKey
  } = body;
  if (!initialPrompt?.trim()) return bad('initialPrompt missing.');
  const config = { ...llm };
  if (!config.geminiKey) config.geminiKey = geminiKey;

  /* 2 ─ content-policy gate ------------------------------------------- */
  const combinedInput = initialPrompt;
  if (await violatesPolicy(combinedInput, config.openaiKey)) {
    return bad('Prompt rejected by content policy.');
  }

  const provider = config.provider || 'openai';

  /* 3 ─ build system prompt ------------------------------------------- */
  const basePrompt   =
    systemPrompt?.trim() ||
    (provider === 'openai' && config.systemPrompt?.trim()) ||
    SYSTEM_PRESETS[preset] ||
    SYSTEM_PRESETS.default;

  const userMsg = insert === 'before'
    ? `${extraInstructions}\n\n${initialPrompt}`
    : `${initialPrompt}${extraInstructions ? `\n\n${extraInstructions}` : ''}`;

  const messages = [
    { role: 'system', content: basePrompt.trim() },
    { role: 'user',   content: userMsg.trim() }
  ];

  const model = config.model || (provider === 'gemini'
    ? 'gemini-2.0-flash'
    : 'GPT-4o mini');

  if (provider === 'gemini') {
    /* 4 ─ Gemini request ----------------------------------------------- */
    try {
      const key = config.geminiKey;
      if (!key) return fail('Gemini key required.');
      const url =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        `${model}:generateContent?key=` + key;

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
  } else {
    /* 4 ─ OpenAI or local primary ------------------------------------ */
    try {
      const url = provider === 'local'
        ? config.localUrl
        : 'https://api.openai.com/v1/chat/completions';
      const apiKey = provider === 'local'
        ? config.localKey
        : config.openaiKey;
      if (provider !== 'local' && !apiKey) return fail('OpenAI key required.');
      
      const aiRes = await fetch(url, {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout?.(30_000)
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const txt  = data?.choices?.[0]?.message?.content?.trim();
        if (txt) return ok(txt);
      } else {
        console.warn('[LLM] HTTP', aiRes.status);
      }
      return fail('OpenAI produced no text.');
    } catch (err) {
      return fail('LLM request failed: ' + err.message);
    }
  }
};

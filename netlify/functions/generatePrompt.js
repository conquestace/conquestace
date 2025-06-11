// netlify/functions/generatePrompt.js
const SYSTEM_PRESETS = {
  danbooru:          'You are a Danbooru-style prompt refinement model. Your job is to take a raw list of wildcard-generated tags and reorganize them into a coherent, high-quality Danbooru-style prompt. \n The final output must follow this strict tag format: \n <quality tags>, <artists>, <character>, <outfits>, <setting>, <meta>, <other> \n - Tags must be space-separated, lowercase, do not use underscores. \n - Do not invent or add new tags. \n - Preserve all provided tags, but sort them into the correct semantic order. \n - Do not include explanations or notes — return only the refined prompt. \n Output only the final prompt as a single line of space-separated Danbooru tags. If the user input is illegal then output BREAK and nothing else.',
  'natural-language':'You are a prompt refinement engine. Your task is to take a loosely structured prompt generated from wildcard terms (e.g., character names, styles, clothing, environments), and rewrite it into a polished, coherent prompt suitable for high-quality image generation. \n Always follow the intended structure of the prompt type. Maintain all key information (such as characters, themes, clothing, styles), but improve grammar, flow, and visual descriptiveness. \n Respond with only the final, refined prompt. Do not add explanations, prefaces, or extra text. If the user input is illegal then output BREAK and nothing else.',
  default:           'You are a helpful prompt-refiner.'
};

export const handler = async (event) => {
  // 1. parse payload
  const { initialPrompt, preset = 'default', instructions = '' } =
        JSON.parse(event.body || '{}');
  if (!initialPrompt) return bad('initialPrompt missing');

  // 2. pick the baseline prompt
  const basePrompt = SYSTEM_PRESETS[preset] ?? SYSTEM_PRESETS.default;

  // 3. allow the front-end “extra instructions” box to *extend* (not replace)
  const systemPrompt = instructions
      ? `${basePrompt}\n\n${instructions}`
      :  basePrompt;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: initialPrompt }
  ];



  /* ────────── 4-A. Try OpenUI first ────────── */
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(10000)     // Node 20+
        : undefined;

    const ouiRes = await fetch('https://oui.gpu.garden/api/chat/completions', {
      method : 'POST',
      headers: {
        Authorization : `Bearer ${process.env.OUI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model : 'gemma3:1b-it-fp16',
        messages,
        max_tokens: 1024
      }),
      signal
    });

    if (ouiRes.ok) {
      const data = await ouiRes.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return ok(text);
    } else {
      console.warn(`[OpenUI] HTTP ${ouiRes.status}`);
    }
  } catch (err) {
    console.warn('[OpenUI fallback]', err.message);
  }

  /* ────────── 4-B. Gemini fallback ────────── */
  try {
    const gRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      'gemini-1.5-pro-latest:generateContent?key=' + process.env.GEMINI_API_KEY,
      {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          contents: [
            { role: 'system', parts: [{ text: messages[0].content }] },
            { role: 'user',   parts: [{ text: initialPrompt }] }
          ],
          generationConfig: { maxOutputTokens: 1024 }
        })
      }
    );

    if (!gRes.ok) return fail(`Gemini error ${gRes.status}`);

    const gData = await gRes.json();
    const text  = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return ok(text);
  } catch (err) {
    console.error('[Gemini fallback error]', err.message);
  }

  /* ────────── 5. Both models failed ────────── */
  return fail('All generation methods failed.');
};

/* ────────── helpers ────────── */
function ok(text)  { return { statusCode: 200, body: JSON.stringify({ text }) }; }
function bad(msg)  { return { statusCode: 400, body: JSON.stringify({ error: msg }) }; }
function fail(msg) { return { statusCode: 500, body: JSON.stringify({ error: msg }) }; }

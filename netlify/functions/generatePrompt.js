/*──────────────────────────────────────────────────────────────────────────────┐
  generatePrompt.js – Netlify function (refined)
  • Supports OpenAI, Gemini, Local with editable system prompts.
  • Gemini is optional – executed only when provider==='gemini' & key supplied.
  • OpenAI/local now use an explicit AbortController timeout (no Node 18 issues).
  • All execution paths end with ok()/fail()/bad() so the client always gets JSON.
└──────────────────────────────────────────────────────────────────────────────*/

import { isAuthorized } from "./_auth.js";
import SYSTEM_PRESETS  from './systemPrompts.json' assert { type: 'json' };
// ── Helpers ────────────────────────────────────────────────────────────────
const ok   = (t)=>({ statusCode:200, body:JSON.stringify({ text:t }) });
const bad  = (m)=>({ statusCode:400, body:JSON.stringify({ error:m }) });
const fail = (m)=>({ statusCode:500, body:JSON.stringify({ error:m }) });

// ── System‑prompt presets ──────────────────────────────────────────────────


// --- quick alias table ------------------------------------------------------
const MODEL_ALIASES = {
  'gpt-4o mini'    : 'gpt-4o-mini',     // spaces → dash
  'gpt‑4o mini'    : 'gpt-4o-mini',     // with unicode hyphen
  'gpt-4o'         : 'gpt-4o-mini',     // treat 4o alone as mini
  'gpt-3.5'        : 'gpt-3.5-turbo',
  'gpt 3.5 turbo'  : 'gpt-3.5-turbo',
};

function normalizeModel(id, provider) {
  if (provider !== 'openai') return id;   // only OpenAI cares here
  const cleaned = id?.trim();
  if (!cleaned) return 'gpt-3.5-turbo';
  // direct hit or lower‑case hit
  return MODEL_ALIASES[cleaned] || MODEL_ALIASES[cleaned.toLowerCase()] || cleaned;
}


// ── Simple policy guard (OpenAI Moderations) ───────────────────────────────
const BLOCK_THRESHOLDS = {
  sexual:0.5,
  'sexual/minors':0.01,
  violence:0.85,
  'violence/graphic':0.6,
  harassment:0.95,
  'harassment/threatening':0.8,
  hate:0.95,
  'hate/threatening':0.8,
  self_harm:0.5
};

async function violatesPolicy(text){
  try{
    const res = await fetch('https://api.openai.com/v1/moderations',{
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.OPENAI_API_KEY}` },
      body:JSON.stringify({ input:text, model:'omni-moderation-latest' })
    });
    if(!res.ok) throw new Error(`mod HTTP ${res.status}`);
    const { results:[{ category_scores:scores }] } = await res.json();
    for(const [cat,limit] of Object.entries(BLOCK_THRESHOLDS))
      if((scores[cat]??0)>=limit) return true;
    return false;
  }catch(err){
    console.warn('[moderation error]',err.message);
    return true; // fail‑closed
  }
}

// ── Main handler ───────────────────────────────────────────────────────────
export const handler = async(event)=>{
  if(!isAuthorized(event))
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  // 1) Parse payload
  let body;
  try{ body = JSON.parse(event.body||'{}'); }
  catch{return bad('Invalid JSON payload.');}

  const { initialPrompt, preset='default', systemPrompt='', instructions='', llm={}, geminiKey } = body;
  if(!initialPrompt?.trim()) return bad('initialPrompt missing.');

  const config = { ...llm };
  if(!config.geminiKey) config.geminiKey = geminiKey; // legacy compat

  // 2) Content‑policy gate
  if(await violatesPolicy(`${initialPrompt}\n\n${instructions}`))
    return bad('Prompt rejected by content policy.');

  const provider = config.provider || 'openai';
  if(!provider) return bad('LLM provider missing.');

  // 3) Build system prompt (preset or custom)
  const basePrompt = systemPrompt.trim() || SYSTEM_PRESETS[preset] || SYSTEM_PRESETS.default;
  const finalPrompt = instructions
    ? `${basePrompt}\n\n${instructions}`
    : basePrompt;
  const messages      = [ { role:'system', content: finalPrompt }, { role:'user', content:initialPrompt } ];
   const rawModel = config.model || (provider === 'gemini' ? 'gemini-2.0-flash' : process.env.OPENAI_MODEL || 'gpt-4o-mini');
  const model    = normalizeModel(rawModel, provider);

  // 4) Provider branches
  if(provider==='openai' || provider==='local'){
    const url    = provider==='local' ? (config.localUrl || process.env.LOCAL_LLM_URL) : 'https://api.openai.com/v1/chat/completions';
    const apiKey = provider==='local' ? (config.localKey || process.env.LOCAL_LLM_KEY) : (config.openaiKey || process.env.OPENAI_API_KEY);

    // Abort after 30s – Node 18‑safe
    const controller = new AbortController();
    const timeoutId  = setTimeout(()=>controller.abort(),30_000);

    try{
      const aiRes = await fetch(url,{
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(apiKey?{ Authorization:`Bearer ${apiKey}` }:{}) },
        body:JSON.stringify({ model, messages, max_tokens:1024 }),
        signal:controller.signal
      });
      clearTimeout(timeoutId);

      if(!aiRes.ok){
        const txt = await aiRes.text().catch(()=>aiRes.statusText);
        return fail(`OpenAI/local HTTP ${aiRes.status}: ${txt.slice(0,200)}`);
      }
      const data = await aiRes.json();
      const txt  = data?.choices?.[0]?.message?.content?.trim();
      if(txt) return ok(txt);
      return fail('OpenAI/local request succeeded but returned no text.');
    }catch(err){
      return fail('OpenAI/local request error: '+err.message);
    }
  }

  if(provider==='gemini'){
    const key = config.geminiKey;
    if(!key) return fail('No Gemini key provided.');

    try{
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          systemInstruction:{ parts:[{ text: finalPrompt }] },
          contents:[ { parts:[{ text:initialPrompt.trim() }] } ],
          generationConfig:{ maxOutputTokens:512 }
        })
      });
      if(!gRes.ok){
        const errTxt = await gRes.text().catch(()=>"");
        return fail(`Gemini HTTP ${gRes.status}: ${errTxt.slice(0,200)}`);
      }
      const data = await gRes.json();
      const txt  = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if(txt) return ok(txt);
      const reason = data?.promptFeedback?.blockReason || 'unknown';
      return fail(`Gemini produced no text – reason: ${reason}`);
    }catch(err){
      return fail('Gemini request failed: '+err.message);
    }
  }

  // Unsupported provider
  return bad(`Unknown provider: ${provider}`);
};

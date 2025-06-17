import fetch from "node-fetch";

export async function handler(event) {
  try {
    const { messages = [], llm = {} } = JSON.parse(event.body || '{}');
    const config = { provider: 'openai', ...llm };
    const provider = config.provider;
    const model = config.model || (provider === 'gemini' ? 'gemini-2.0-flash' : 'GPT-4o mini');

    const userInput = messages[messages.length - 1]?.content ?? "";
    const systemPrompt = {
  role: "system",
  content: "You are a corrupted and glitched system terminal for conquestace.com. Respond to user input in terse, cryptic, and eerie terminal-style output. Do not use markdown. Do not explain. Output only the raw shell-like result."
};

const fullMessages = [systemPrompt, ...messages];

    if (provider === 'gemini') {
      // === Gemini ===
      try {
        const key = config.geminiKey;
        if (!key) throw new Error('Gemini key required');
        const prompt = messages.map(m => ` ${m.content}`).join('\n');

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [ { parts: [ { text: prompt } ] } ]
          })
        });

        const geminiData = await geminiRes.json();
        const geminiOutput =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (geminiOutput.trim()) {
          return {
            statusCode: 200,
            body: JSON.stringify({ text: geminiOutput, model: 'gemini' })
          };
        }
        throw new Error('Gemini returned no usable output');
      } catch (err) {
        return {
          statusCode: 500,
          body: JSON.stringify({ text: 'Gemini error: ' + err.message })
        };
      }
    }

    // === OpenAI/local ===
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const url = provider === 'local'
        ? config.localUrl
        : 'https://api.openai.com/v1/chat/completions';
      const key = provider === 'local'
        ? config.localKey
        : config.openaiKey;
      if (provider !== 'local' && !key) throw new Error('OpenAI key required');

      const aiRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          max_tokens: 1000,
          top_p: 0.9,
          temperature: 0.1,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
          stop: ["INVALID QUERY", "BREAK"]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const contentType = aiRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await aiRes.text();
        throw new Error(`LLM returned non-JSON: ${errorText}`);
      }

      const aiData = await aiRes.json();
      const output = aiData?.choices?.[0]?.message?.content;

      if (output && output.trim()) {
        return {
          statusCode: 200,
          body: JSON.stringify({ text: output, model: provider })
        };
      }

      throw new Error("LLM returned no usable output.");
    } catch (aiErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({ text: 'LLM error: ' + aiErr.message })
      };
    }

  } catch (fatalErr) {
    console.error("[Fatal LLM Router Error]:", fatalErr.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ text: "Fatal error: " + fatalErr.message })
    };
  }
}

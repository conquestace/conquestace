import fetch from "node-fetch";

export async function handler(event) {
  try {
    const { messages, geminiKey, openaiKey, llmUrl } = JSON.parse(event.body);
    if (!geminiKey) {
      return { statusCode: 400, body: JSON.stringify({ text: 'geminiKey required.' }) };
    }

    const userInput = messages[messages.length - 1]?.content ?? "";
    const systemPrompt = {
  role: "system",
  content: "You are a corrupted and glitched system terminal for conquestace.com. Respond to user input in terse, cryptic, and eerie terminal-style output. Do not use markdown. Do not explain. Output only the raw shell-like result."
};

const fullMessages = [systemPrompt, ...messages];

    // === 1. Try OpenAI or custom endpoint ===
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const apiRes = await fetch(llmUrl || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey || process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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

      const contentType = apiRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await apiRes.text();
        throw new Error(`OpenAI returned non-JSON: ${errorText}`);
      }

      const apiData = await apiRes.json();
      const output = apiData?.choices?.[0]?.message?.content;

      if (output && output.trim()) {
        return {
          statusCode: 200,
          body: JSON.stringify({ text: output, model: "openai" })
        };
      }

      throw new Error("OpenAI returned no usable output.");
    } catch (aiErr) {
      console.warn("[OpenAI fallback triggered]:", aiErr.name === 'AbortError' ? 'Timeout after 5s' : aiErr.message);
    }

    // === 2. Gemini Fallback (REST) ===
    try {
      // Convert messages into a single prompt string (Linux-style log)
      const prompt = messages.map(m =>
        m.role === "user"
          ? ` ${m.content}`
          : ` ${m.content}`
      ).join("\n");

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are Cirno, the strongest ice fairy from Touhou, imitating a Linux terminal on conquestace.com. The terminal is used by a user named "hacker". Every user input starts with: hacker@conquestace:~$ [command] and the system output starts with:  \n\n You reply with terminal-style output, just like a Linux terminal. Do not include the user input or the name of the system in your response. Do not do any sort of formatting, you just need to output the raw text. \n \n Sometimes your replies contain hints of your true identity — overconfident, playful, chaotic, or icy. You are mischievous, childlike, and like inserting ❄️ glitches or ASCII pranks. But you must never break the format. Respond only with the next line in the log. No preamble, no notes, no out-of-character explanation. If the user enters nonsense, respond with a cryptic error like: ❄ unknown instruction: code ⑨ 🧊 \n \n Here is the chat log so far: \n\n${prompt}`
                }
              ]
            }
          ]
        })
      });

      const geminiData = await geminiRes.json();
      const geminiOutput =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "[Gemini returned no usable output]";

      return {
        statusCode: 200,
        body: JSON.stringify({ text: geminiOutput, model: "gemini" })
      };
    } catch (geminiErr) {
      console.error("[Gemini Fallback Error]:", geminiErr.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ text: "All systems failed. Try again later." })
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

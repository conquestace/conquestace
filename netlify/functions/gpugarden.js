import fetch from "node-fetch";

export async function handler(event) {
  try {
    const { input, openaiKey, llmUrl } = JSON.parse(event.body);

    const url = llmUrl || 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${openaiKey || process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const data = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a corrupted system terminal. Reply like a glitched Linux shell. Keep it short, eerie, and fragmented. No markdown or code blocks.',
        },
        {
          role: 'user',
          content: input
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    const result = await response.json();

    const output = result?.choices?.[0]?.message?.content ?? '[no response]';

    return {
      statusCode: 200,
      body: JSON.stringify({ text: output })
    };
  } catch (err) {
    console.error("DeepSeek handler error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ text: "Error: " + err.message })
    };
  }
}

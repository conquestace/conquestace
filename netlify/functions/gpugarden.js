import fetch from "node-fetch";
import { isAuthorized } from "./_auth.js";

export async function handler(event) {
  if(!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    const input = JSON.parse(event.body).input;
    const token = process.env.DEEPSEEK_API_KEY;

    const url = 'https://oui.gpu.garden/api/chat/completions';
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const data = {
      model: 'gemma3:1b-it-fp16',
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

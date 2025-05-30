export async function handler(event) {
  const input = JSON.parse(event.body).input;

  const apiKey = process.env.GEMINI_API_KEY;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + apiKey;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: `You are a glitchy console AI. Respond like a terminal. Q: ${input}` }] }
      ]
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[No response]";

  return {
    statusCode: 200,
    body: JSON.stringify({ text })
  };
}

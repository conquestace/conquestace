export async function handler(event) {
  try {
    const input = JSON.parse(event.body).input;
    const apiKey = process.env.GEMINI_API_KEY;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a corrupted system terminal. Respond to the user's input "${input}" in a style consistent with a Linux shell, but with occasional eerie or cryptic glitches. Keep responses short. Don't explain anything. If the user enters nonsense, respond with ambiguous or system-style errors. Do not act like a chatbot.`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    console.log("Gemini raw response:", JSON.stringify(data, null, 2));

    // Attempt to extract the reply
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "[Gemini returned no usable output]\n" + JSON.stringify(data);

    return {
      statusCode: 200,
      body: JSON.stringify({ text })
    };
  } catch (err) {
    console.error("Gemini handler error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ text: "Error: " + err.message })
    };
  }
}
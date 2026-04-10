export async function POST(request) {
  const { system, messages, maxTokens = 800 } = await request.json();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const geminiMessages = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const contents = system
    ? [{ role: "user", parts: [{ text: system }] }, { role: "model", parts: [{ text: "Anladım, hazırım." }] }, ...geminiMessages]
    : geminiMessages;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 } }),
        signal: AbortSignal.timeout(20000),
      }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hata.";
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

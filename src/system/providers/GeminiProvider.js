function clean(value) {
  return String(value || "").replace(/"/g, "").trim();
}

class GeminiProvider {
  constructor() {
    this.name = "gemini";
  }

  isAvailable() {
    return Boolean(clean(process.env.GEMINI_API_KEY));
  }

  getModel() {
    return clean(process.env.GEMINI_MODEL || "gemini-1.5-flash");
  }

  async ask({ systemPrompt = "", userPrompt = "" } = {}) {
    const apiKey = clean(process.env.GEMINI_API_KEY);

    if (!apiKey) throw new Error("Gemini API key não configurada.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.getModel()}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt || "És a IA da Cristal Water."}\n\n${userPrompt || ""}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      provider: this.name,
      model: this.getModel(),
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      raw: data,
    };
  }
}

module.exports = new GeminiProvider();

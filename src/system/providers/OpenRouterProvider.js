function clean(value) {
  return String(value || "").replace(/"/g, "").trim();
}

class OpenRouterProvider {
  constructor() {
    this.name = "openrouter";
  }

  isAvailable() {
    return Boolean(clean(process.env.OPENROUTER_API_KEY));
  }

  getModel() {
    return clean(process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free");
  }

  async ask({ systemPrompt = "", userPrompt = "", temperature = 0.2 } = {}) {
    const apiKey = clean(process.env.OPENROUTER_API_KEY);

    if (!apiKey) throw new Error("OpenRouter API key não configurada.");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://cristalwater.pt",
        "X-Title": "Cristal OS",
      },
      body: JSON.stringify({
        model: this.getModel(),
        messages: [
          { role: "system", content: systemPrompt || "És a IA da Cristal Water." },
          { role: "user", content: userPrompt || "" },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      provider: this.name,
      model: this.getModel(),
      text: data.choices?.[0]?.message?.content || "",
      raw: data,
    };
  }
}

module.exports = new OpenRouterProvider();

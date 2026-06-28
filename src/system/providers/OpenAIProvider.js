function clean(value) {
  return String(value || "").replace(/"/g, "").trim();
}

class OpenAIProvider {
  constructor() {
    this.name = "openai";
  }

  isAvailable() {
    return Boolean(clean(process.env.OPENAI_API_KEY));
  }

  getModel() {
    return clean(process.env.OPENAI_MODEL || process.env.DEFAULT_AI_MODEL || "gpt-4o-mini");
  }

  async ask({ systemPrompt = "", userPrompt = "", temperature = 0.2 } = {}) {
    const apiKey = clean(process.env.OPENAI_API_KEY);

    if (!apiKey) throw new Error("OpenAI API key não configurada.");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.getModel(),
        input: [
          { role: "system", content: systemPrompt || "És a IA da Cristal Water." },
          { role: "user", content: userPrompt || "" },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      provider: this.name,
      model: this.getModel(),
      text: data.output_text || "",
      raw: data,
    };
  }
}

module.exports = new OpenAIProvider();

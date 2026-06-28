function clean(value) {
  return String(value || "").replace(/"/g, "").trim();
}

class OllamaProvider {
  constructor() {
    this.name = "ollama";
  }

  isAvailable() {
    return clean(process.env.OLLAMA_ENABLED || "false") === "true";
  }

  getHost() {
    return clean(process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
  }

  getModel() {
    return clean(process.env.OLLAMA_MODEL || "llama3.1");
  }

  async ask({ systemPrompt = "", userPrompt = "" } = {}) {
    if (!this.isAvailable()) throw new Error("Ollama não está ativo.");

    const response = await fetch(`${this.getHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.getModel(),
        messages: [
          { role: "system", content: systemPrompt || "És a IA da Cristal Water." },
          { role: "user", content: userPrompt || "" },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      provider: this.name,
      model: this.getModel(),
      text: data.message?.content || "",
      raw: data,
    };
  }
}

module.exports = new OllamaProvider();

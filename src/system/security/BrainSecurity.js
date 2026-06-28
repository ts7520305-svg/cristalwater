class BrainSecurity {
  sanitizePrompt(text = "") {
    return String(text)
      .replace(/OPENAI_API_KEY=[^\s]+/g, "OPENAI_API_KEY=[REDACTED]")
      .replace(/sk-[A-Za-z0-9_\-]+/g, "[REDACTED_API_KEY]")
      .trim();
  }

  checkPrompt(text = "") {
    const clean = this.sanitizePrompt(text);

    return {
      ok: true,
      originalLength: String(text).length,
      sanitizedLength: clean.length,
      sanitized: clean,
    };
  }
}

module.exports = new BrainSecurity();

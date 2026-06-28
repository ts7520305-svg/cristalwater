class Validator {
  static required(value, fieldName = "campo") {
    if (value === undefined || value === null || value === "") {
      return `${fieldName} é obrigatório.`;
    }
    return null;
  }

  static email(value, fieldName = "email") {
    if (!value) return null;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    return ok ? null : `${fieldName} inválido.`;
  }

  static minLength(value, min, fieldName = "campo") {
    if (!value) return null;
    return String(value).length >= min ? null : `${fieldName} deve ter pelo menos ${min} caracteres.`;
  }

  static validate(rules = []) {
    const errors = [];

    for (const rule of rules) {
      const error = rule();
      if (error) errors.push(error);
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }
}

module.exports = Validator;

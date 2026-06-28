class CrystalError extends Error {
  constructor(message, { code = "CRYSTAL_ERROR", status = 500, details = {} } = {}) {
    super(message);
    this.name = "CrystalError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
      createdAt: this.createdAt,
    };
  }
}

module.exports = CrystalError;

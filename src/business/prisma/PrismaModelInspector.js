const fs = require("fs");
const path = require("path");

class PrismaModelInspector {
  constructor() {
    this.schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  }

  readSchema() {
    return fs.readFileSync(this.schemaPath, "utf8");
  }

  getModelBlock(modelName) {
    const schema = this.readSchema();
    const regex = new RegExp(`model ${modelName} \\\\{([\\\\s\\\\S]*?)\\\\n\\\\}`, "m");
    const match = schema.match(regex);

    if (!match) return null;

    return `model ${modelName} {${match[1]}\n}`;
  }

  listModels() {
    const schema = this.readSchema();
    return [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1]);
  }

  inspect(models = []) {
    const selected = models.length ? models : this.listModels();

    return selected.map((model) => ({
      model,
      block: this.getModelBlock(model),
    }));
  }
}

module.exports = new PrismaModelInspector();

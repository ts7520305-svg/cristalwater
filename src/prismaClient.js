require("./loadEnv")();

const { PrismaClient } = require("@prisma/client");

const prisma = global.__CRISTAL_WATER_PRISMA__ || new PrismaClient({
  log: process.env.PRISMA_DEBUG === "true" ? ["query", "info", "warn", "error"] : ["warn", "error"],
});

if (process.env.NODE_ENV !== "production") {
  global.__CRISTAL_WATER_PRISMA__ = prisma;
}

// Compatibilidade total para importacao direta e desestruturada.
module.exports = prisma;
module.exports.prisma = prisma;

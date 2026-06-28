// Ligação central Prisma reutilizada em todo o backend.
// Mantém compatibilidade com controllers antigos que importam ../db/connection.

const { prisma } = require("../prismaClient");

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("[DB] Ligação Prisma ativa.");
  } catch (err) {
    console.error("[DB] Erro ao ligar à base de dados:", err.message);
    throw err;
  }
}

module.exports = {
  connectDB,
  prisma,
};

// ==========================================
// REFRESH TOKEN CLEANUP SERVICE
// ==========================================

const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;

async function cleanupExpiredRefreshTokens() {
  try {
    const now = new Date();

    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    console.log(
      `[CRON] Refresh tokens expirados removidos: ${result.count}`
    );
  } catch (err) {
    console.error(
      "[CRON] Erro ao limpar refresh tokens:",
      err.message
    );
  }
}

module.exports = {
  cleanupExpiredRefreshTokens,
};
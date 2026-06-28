const express = require("express");
const router = express.Router();

const { prisma } = require("../prismaClient");

// ==========================================
// LISTAR COMUNICAÇÕES
// ==========================================

router.get("/", async (req, res) => {
  try {
    const logs = await prisma.communicationLog.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      ok: true,
      logs
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");

// ==========================================================
// 🔥 CRIAR VISITA EXTRA (COM TÉCNICO)
// ==========================================================

router.post("/", async (req, res) => {
  try {

    const { poolId, scheduledAt, price, userId } = req.body;

    if (!poolId || !scheduledAt || !userId) {
      return res.json({
        ok: false,
        message: "Dados inválidos"
      });
    }

    const extra = await prisma.extraVisit.create({
      data: {
        poolId: Number(poolId),
        userId: Number(userId), // 🔥 NOVO (TÉCNICO)
        scheduledAt: new Date(scheduledAt),
        price: price ? Number(price) : 0
      }
    });

    res.json({ ok: true, extra });

  } catch (err) {
    console.error("Erro criar extra:", err);
    res.json({ ok: false });
  }
});

// ==========================================================
// LISTAR EXTRAS (NÃO FATURADOS)
// ==========================================================

router.get("/", async (req, res) => {
  try {

    const extras = await prisma.extraVisit.findMany({
      where: { billed: false },
      include: {
        pool: {
          include: { client: true }
        },
        user: true // 🔥 NOVO
      },
      orderBy: { scheduledAt: "desc" }
    });

    res.json({ ok: true, extras });

  } catch (err) {
    console.error("Erro listar extras:", err);
    res.json({ ok: false });
  }
});

// ==========================================================
// 🔥 HISTÓRICO (FATURADOS)
// ==========================================================

router.get("/history", async (req, res) => {
  try {

    const extras = await prisma.extraVisit.findMany({
      where: { billed: true },
      include: {
        pool: {
          include: { client: true }
        },
        user: true
      },
      orderBy: { billedAt: "desc" }
    });

    res.json({ ok: true, extras });

  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

// ==========================================================
// MARCAR COMO FATURADO
// ==========================================================

router.post("/confirm", async (req, res) => {
  try {

    await prisma.extraVisit.updateMany({
      where: { billed: false },
      data: {
        billed: true,
        billedAt: new Date() // 🔥 NOVO
      }
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("Erro faturar:", err);
    res.json({ ok: false });
  }
});

module.exports = router;
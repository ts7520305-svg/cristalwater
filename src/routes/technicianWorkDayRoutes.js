const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");

// ==========================================================
// INICIAR DIA
// ==========================================================
router.post("/start", async (req, res) => {
  try {

    const { userId } = req.body;

    if (!userId) {
      return res.json({ ok: false, message: "userId obrigatório" });
    }

    const today = new Date();
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    // evitar duplicar dia
    const exists = await prisma.technicianWorkDay.findFirst({
      where: {
        userId: Number(userId),
        date: date
      }
    });

    if (exists) {
      return res.json({
        ok: true,
        message: "Dia já iniciado",
        workDay: exists
      });
    }

    const workDay = await prisma.technicianWorkDay.create({
      data: {
        userId: Number(userId),
        date: date,
        status: "ACTIVE"
      }
    });

    res.json({ ok: true, workDay });

  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

// ==========================================================
// TERMINAR DIA
// ==========================================================
router.post("/end", async (req, res) => {
  try {

    const { userId } = req.body;

    const today = new Date();
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const workDay = await prisma.technicianWorkDay.updateMany({
      where: {
        userId: Number(userId),
        date: date,
        status: "ACTIVE"
      },
      data: {
        status: "CLOSED",
        endAt: new Date()
      }
    });

    res.json({ ok: true, workDay });

  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

// ==========================================================
// ESTADO DO DIA
// ==========================================================
router.get("/status/:userId", async (req, res) => {
  try {

    const userId = Number(req.params.userId);

    const today = new Date();
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const workDay = await prisma.technicianWorkDay.findFirst({
      where: {
        userId,
        date
      }
    });

    res.json({ ok: true, workDay });

  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

module.exports = router;
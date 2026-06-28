const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const clientPortalController = require("../controllers/clientPortalController");

async function getClientHistory(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    const visits = await prisma.serviceVisit.findMany({
      where: { pool: { is: { clientId } } },
      include: { pool: true, photos: true },
      orderBy: { startAt: "desc" },
    });
    res.json({ ok: true, visits });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, visits: [] });
  }
}

async function getLatestVisit(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    const visit = await prisma.serviceVisit.findFirst({
      where: { pool: { is: { clientId } } },
      include: { pool: true, photos: true },
      orderBy: { startAt: "desc" },
    });
    res.json({ ok: true, visit });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, visit: null });
  }
}

// Aliases usados pelos frontends atuais.
router.get("/history/:clientId", getClientHistory);
router.get("/latest/:clientId", getLatestVisit);
router.get("/:clientId(\\d+)/history", getClientHistory);
router.get("/:clientId(\\d+)/latest", getLatestVisit);

// Portal cliente base.
router.post("/:clientId(\\d+)/payment-notice", clientPortalController.notifyPayment);
router.get("/:clientId(\\d+)", clientPortalController.getClientPortal);

module.exports = router;

const express = require("express");
const ClientPrismaService = require("../prisma/ClientPrismaService");

const router = express.Router();

router.get("/clients/count", async (req, res) => {
  try {
    const count = await ClientPrismaService.count();
    res.json({ ok: true, count });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/clients/first", async (req, res) => {
  try {
    const client = await ClientPrismaService.first();
    res.json({ ok: true, client });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const auth = require("../middlewares/authMiddleware");

router.use(auth("ADMIN"));

function cleanPayload(body = {}) {
  return {
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    pin: body.pin || null,
    zone: body.zone || null,
    role: body.role || "TECHNICIAN",
    active: body.active !== undefined ? Boolean(body.active) : true,
    vehicleId: body.vehicleId !== undefined && body.vehicleId !== null && body.vehicleId !== "" ? Number(body.vehicleId) : null,
    latitude: body.latitude !== undefined && body.latitude !== null && body.latitude !== "" ? Number(body.latitude) : null,
    longitude: body.longitude !== undefined && body.longitude !== null && body.longitude !== "" ? Number(body.longitude) : null,
    costPerVisit: body.costPerVisit !== undefined ? Number(body.costPerVisit) : 0,
    hourlyCost: body.hourlyCost !== undefined ? Number(body.hourlyCost) : 0,
    commissionRate: body.commissionRate !== undefined ? Number(body.commissionRate) : 0.1,
  };
}

router.get("/", async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({ orderBy: { name: "asc" } });
    res.json(technicians);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar técnicos" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const technician = await prisma.technician.findUnique({ where: { id } });
    if (!technician) return res.status(404).json({ error: "Técnico não encontrado" });
    res.json(technician);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter técnico" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = cleanPayload(req.body);
    if (!data.name) return res.status(400).json({ error: "Nome obrigatório" });
    const technician = await prisma.technician.create({ data });
    res.status(201).json(technician);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar técnico" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = cleanPayload(req.body);
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    const technician = await prisma.technician.update({ where: { id }, data });
    res.json(technician);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar técnico" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.technician.update({ where: { id }, data: { active: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao desativar técnico" });
  }
});

module.exports = router;

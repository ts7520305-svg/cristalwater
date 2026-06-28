const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");

// LISTAR
router.get("/", async (req,res)=>{
  const zones = await prisma.zone.findMany();
  res.json(zones);
});

// CRIAR
router.post("/", async (req,res)=>{
  const z = await prisma.zone.create({ data:req.body });
  res.json(z);
});

// EDITAR
router.put("/:id", async (req,res)=>{
  const z = await prisma.zone.update({
    where:{ id:Number(req.params.id) },
    data:req.body
  });
  res.json(z);
});

// APAGAR
router.delete("/:id", async (req,res)=>{
  await prisma.zone.delete({
    where:{ id:Number(req.params.id) }
  });
  res.json({ ok:true });
});

module.exports = router;
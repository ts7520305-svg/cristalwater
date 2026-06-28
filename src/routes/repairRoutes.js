const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const { prisma } = require("../prismaClient");

// ==========================================
// CRIAR REPARAÇÃO
// ==========================================
router.post("/", async (req, res) => {
  try {
    const { poolId, problem, quantity, priority, notes } = req.body;

    if (!poolId || !problem) {
      return res.status(400).json({
        ok: false,
        message: "Dados inválidos",
      });
    }

    const qty = Number(quantity || 1);

    let unitPrice = 0;

    if (problem.toLowerCase().includes("luz")) {
      unitPrice = 120;
    } else if (problem.toLowerCase().includes("bomba")) {
      unitPrice = 350;
    } else {
      unitPrice = 100;
    }

    const totalPrice = unitPrice * qty;

    const repair = await prisma.repair.create({
      data: {
        poolId: Number(poolId),
        problem,
        quantity: qty,
        priority: priority || "NORMAL",
        notes: notes || "",
        unitPrice,
        totalPrice,
        status: "PENDING",
      },
    });

    return res.json({
      ok: true,
      repair,
    });
  } catch (error) {
    console.error("Erro ao criar reparação:", error);
    return res.status(500).json({
      ok: false,
      message: "Erro ao criar reparação",
    });
  }
});

// ==========================================
// LISTAR REPARAÇÕES POR PISCINA
// ==========================================
router.get("/pool/:poolId", async (req, res) => {
  try {
    const poolId = Number(req.params.poolId);

    const repairs = await prisma.repair.findMany({
      where: {
        poolId,
        status: {
          in: ["PENDING", "QUOTED", "APPROVED", "INVOICED"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(repairs);
  } catch (error) {
    console.error("Erro ao listar reparações:", error);
    res.status(500).json({ error: "Erro ao listar reparações" });
  }
});

// ==========================================
// GERAR PDF DA REPARAÇÃO
// ==========================================
router.get("/:id/pdf", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const repair = await prisma.repair.findUnique({
      where: { id },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!repair) {
      return res.status(404).json({
        ok: false,
        message: "Reparação não encontrada",
      });
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const fileName = `reparacao_${repair.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    doc.pipe(res);

    // Cabeçalho
    doc
      .fontSize(22)
      .fillColor("#1e88e5")
      .text("Cristal Water", { align: "left" });

    doc
      .moveDown(0.2)
      .fontSize(12)
      .fillColor("#444444")
      .text("Orçamento / Reparação de Piscina", { align: "left" });

    doc.moveDown(1);

    // Linha separadora
    doc
      .strokeColor("#1e88e5")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown(1);

    // Dados cliente
    doc
      .fontSize(14)
      .fillColor("#111111")
      .text("Dados do cliente", { underline: true });

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#222222");
    doc.text(`Cliente: ${repair.pool?.client?.name || "-"}`);
    doc.text(`Telefone: ${repair.pool?.client?.phone || "-"}`);
    doc.text(`Morada: ${repair.pool?.client?.address || "-"}`);
    doc.text(`Piscina: ${repair.pool?.name || "-"}`);
    doc.text(`Local: ${repair.pool?.location || "-"}`);

    doc.moveDown(1);

    // Dados reparação
    doc
      .fontSize(14)
      .fillColor("#111111")
      .text("Detalhes da reparação", { underline: true });

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#222222");
    doc.text(`ID da reparação: ${repair.id}`);
    doc.text(`Problema: ${repair.problem || "-"}`);
    doc.text(`Quantidade: ${repair.quantity || 0}`);
    doc.text(`Prioridade: ${repair.priority || "-"}`);
    doc.text(`Estado: ${repair.status || "-"}`);
    doc.text(`Data: ${new Date(repair.createdAt).toLocaleDateString("pt-PT")}`);
    doc.text(`Notas: ${repair.notes || "-"}`);

    doc.moveDown(1);

    // Valores
    doc
      .fontSize(14)
      .fillColor("#111111")
      .text("Valores", { underline: true });

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#222222");
    doc.text(`Preço unitário: ${(Number(repair.unitPrice || 0)).toFixed(2)} €`);
    doc.text(`Total: ${(Number(repair.totalPrice || 0)).toFixed(2)} €`);

    doc.moveDown(0.8);

    // Nota IVA profissional
    doc
      .fontSize(10)
      .fillColor("#444444")
      .text("Nota: Os valores apresentados neste documento não incluem IVA.", {
        align: "left",
      });

    doc.moveDown(0.4);

    // Validade opcional profissional
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text("Validade do orçamento: 15 dias.", {
        align: "left",
      });

    doc.moveDown(1.2);

    // Nota final
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(
        "Documento gerado automaticamente pelo sistema Cristal Water.",
        { align: "left" }
      );

    doc.end();
  } catch (error) {
    console.error("Erro ao gerar PDF da reparação:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao gerar PDF da reparação",
    });
  }
});

// ==========================================
// MARCAR COMO ORÇAMENTADA
// ==========================================
router.put("/:id/quote", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const repair = await prisma.repair.update({
      where: { id },
      data: {
        status: "QUOTED",
      },
    });

    res.json({
      ok: true,
      repair,
    });
  } catch (error) {
    console.error("Erro ao gerar orçamento da reparação:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao gerar orçamento da reparação",
    });
  }
});

// ==========================================
// MARCAR COMO APROVADA
// ==========================================
router.put("/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const repair = await prisma.repair.update({
      where: { id },
      data: {
        status: "APPROVED",
      },
    });

    res.json({
      ok: true,
      repair,
    });
  } catch (error) {
    console.error("Erro ao aprovar reparação:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao aprovar reparação",
    });
  }
});

// ==========================================
// MARCAR COMO FATURADA
// ==========================================
router.put("/:id/invoice", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const repair = await prisma.repair.update({
      where: { id },
      data: {
        status: "INVOICED",
      },
    });

    res.json({
      ok: true,
      repair,
    });
  } catch (error) {
    console.error("Erro ao enviar reparação para faturação:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao enviar reparação para faturação",
    });
  }
});

// ==========================================
// REGISTAR ENVIO AO CLIENTE
// ==========================================
router.put("/:id/mark-sent", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { channel, message } = req.body;

    const repair = await prisma.repair.findUnique({
      where: { id },
    });

    if (!repair) {
      return res.status(404).json({
        ok: false,
        message: "Reparação não encontrada",
      });
    }

    const historyMessage =
      channel && message
        ? `Mensagem de reparação enviada ao cliente via ${channel}. Problema: ${repair.problem}. Mensagem: ${message}`
        : channel
          ? `Mensagem de reparação enviada ao cliente via ${channel}. Problema: ${repair.problem}.`
          : `Mensagem de reparação enviada ao cliente. Problema: ${repair.problem}.`;

    await prisma.technicalHistory.create({
      data: {
        poolId: repair.poolId,
        type: "CLIENT_MESSAGE",
        message: historyMessage,
      },
    });

    res.json({
      ok: true,
      message: "Envio ao cliente registado no histórico",
    });
  } catch (error) {
    console.error("Erro ao registar envio ao cliente:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao registar envio ao cliente",
    });
  }
});

// ==========================================
// CONCLUIR REPARAÇÃO
// ==========================================
router.put("/:id/complete", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const repair = await prisma.repair.update({
      where: { id },
      data: {
        status: "DONE",
        doneAt: new Date(),
      },
    });

    res.json(repair);
  } catch (error) {
    console.error("Erro ao concluir reparação:", error);
    res.status(500).json({ error: "Erro ao concluir reparação" });
  }
});

// ==========================================
// ELIMINAR REPARAÇÃO
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.repair.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao eliminar reparação:", error);
    res.status(500).json({ error: "Erro ao eliminar reparação" });
  }
});

module.exports = router;
// ==========================================
// EXTRA VISIT CONTROLLER (FINAL BILLING FIX)
// ==========================================

const { prisma } = require("../prismaClient");

// ==========================================
// HELPERS
// ==========================================

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeBillingMode(value) {
  const mode = String(value || "EXTRA").trim().toUpperCase();
  return ["EXTRA", "INCLUDED", "NO_CHARGE"].includes(mode) ? mode : "EXTRA";
}

function normalizeAssignmentMode(value) {
  const mode = String(value || "").trim().toUpperCase();
  return [
    "NORMAL",
    "SUPPORT",
    "SUBSTITUTION",
    "OTHER_DAY",
    "RESCHEDULE",
    "UNASSIGNED",
  ].includes(mode) ? mode : "NORMAL";
}

function assignmentModeLabel(mode) {
  return {
    NORMAL: "Operacao normal",
    SUPPORT: "Apoio a outro tecnico",
    SUBSTITUTION: "Substituicao de tecnico",
    OTHER_DAY: "Servico feito noutro dia",
    RESCHEDULE: "Reagendamento",
    UNASSIGNED: "Visita sem tecnico atribuido",
  }[mode] || "Operacao normal";
}

function appendPlannerNote(currentNotes, note) {
  const clean = String(note || "").trim();
  if (!clean) return currentNotes || null;
  const previous = String(currentNotes || "").trim();
  return [previous, `[Planeador] ${clean}`].filter(Boolean).join("\n");
}

function billingDataFromBody(body = {}) {
  const billingMode = normalizeBillingMode(body.billingMode);
  const unitPrice = toNumber(body.unitPrice ?? body.price);
  const quantity = Math.max(1, Number(body.quantity || 1));
  const totalPrice = toNumber(body.totalPrice) ?? (unitPrice !== null ? unitPrice * quantity : null);
  const isBillable = billingMode === "EXTRA" && Number(totalPrice || 0) > 0;

  return {
    billingMode,
    billingStatus: isBillable ? "PENDING" : "NOT_BILLABLE",
    commercialRule: billingMode === "EXTRA" ? "EXTRA_BILLABLE" : billingMode,
    isBillable,
    unitPrice: billingMode === "EXTRA" ? unitPrice : null,
    totalPrice: billingMode === "EXTRA" ? totalPrice : null,
    price: billingMode === "EXTRA" ? Number(totalPrice || unitPrice || 0) : 0,
    includedInPackage: billingMode === "INCLUDED",
  };
}

// ==========================================
// APPEND TO BILLING
// ==========================================

async function appendToBilling(extraVisit) {

  if (!extraVisit) return;
  if (extraVisit.status !== "DONE") return;

  const pool = await prisma.pool.findUnique({
    where: { id: extraVisit.poolId },
    include: { client: true },
  });

  if (!pool?.client?.id) return;

  const clientId = pool.client.id;
  const month = new Date().toISOString().slice(0, 7);

  const amount = Number(extraVisit.totalPrice || extraVisit.unitPrice || 0);
  if (!amount) return;

  let report = await prisma.monthlyReport.findFirst({
    where: {
      clientId,
      month,
      type: "EXTRA_VISITS",
    },
  });

  if (!report) {
    report = await prisma.monthlyReport.create({
      data: {
        clientId,
        month,
        type: "EXTRA_VISITS",
        data: { items: [] },
      },
    });
  }

  const data = report.data || { items: [] };

  data.items.push({
    visitId: extraVisit.id,
    source: "EXTRA_VISIT",
    poolId: extraVisit.poolId,
    clientId,
    poolName: pool.name,
    amount,
    date: extraVisit.scheduledAt,
    billingMode: extraVisit.billingMode || "EXTRA",
    status: extraVisit.status || "DONE",
    notes: extraVisit.notes || null,
  });

  await prisma.monthlyReport.update({
    where: { id: report.id },
    data: { data },
  });

  await prisma.extraVisit.update({
    where: { id: extraVisit.id },
    data: { billed: true, billedAt: new Date(), billingStatus: "IN_MONTHLY_REPORT" },
  }).catch(() => null);
}

// ==========================================
// CREATE
// ==========================================

async function createExtraVisit(req, res) {
  try {
    const poolId = toNumber(req.body.poolId);
    const scheduledAt = toDate(req.body.scheduledAt);
    if (!poolId) return res.status(400).json({ ok: false, error: "Piscina obrigatoria" });
    if (!scheduledAt) return res.status(400).json({ ok: false, error: "Data da visita obrigatoria" });

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { id: true, clientId: true },
    });
    if (!pool) return res.status(404).json({ ok: false, error: "Piscina nao encontrada" });

    const technicianId = toNumber(req.body.technicianId) || null;
    if (technicianId) {
      const technician = await prisma.technician.findUnique({ where: { id: technicianId }, select: { id: true } });
      if (!technician) return res.status(404).json({ ok: false, error: "Tecnico nao encontrado" });
    }

    const visit = await prisma.extraVisit.create({
      data: {
        clientId: pool.clientId,
        poolId,
        technicianId,
        scheduledAt,
        status: "PLANNED",
        visitType: req.body.visitType || "ONE_OFF",
        type: req.body.type || "EXTRA_SERVICE",
        source: req.body.source || "ADMIN_PLANNER",
        origin: req.body.origin || "ADMIN",
        notes: req.body.notes || null,
        internalNote: req.body.internalNote || null,
        ...billingDataFromBody(req.body),
      },
    });

    return res.json({ ok: true, extraVisit: visit });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
}

// ==========================================
// LIST
// ==========================================

async function listExtraVisits(req, res) {
  const visits = await prisma.extraVisit.findMany({
    include: {
      pool: { include: { client: true } },
      technician: true,
    },
  });

  return res.json({ ok: true, extraVisits: visits });
}

// ==========================================
// UPDATE STATUS (🔥 FIX AQUI)
// ==========================================

async function updateExtraVisitStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "").trim().toUpperCase();
    if (!status) return res.status(400).json({ ok: false, error: "Estado obrigatorio" });

    const updated = await prisma.extraVisit.update({
      where: { id },
      data: { status },
    });

    // 🔥 AGORA FUNCIONA
    await appendToBilling(updated);

    return res.json({
      ok: true,
      message: "Visita atualizada",
      extraVisit: updated,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
}

async function updateExtraVisit(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Visita extra invalida" });
    }

    const body = req.body || {};
    const data = {};
    const current = await prisma.extraVisit.findUnique({
      where: { id },
      include: { technician: true },
    });
    if (!current) return res.status(404).json({ ok: false, error: "Visita extra nao encontrada" });

    const assignmentMode = normalizeAssignmentMode(body.assignmentMode);
    const noteParts = [];
    let technicianChanged = false;
    let dateChanged = false;
    let nextTechnicianName = current.technician?.name || current.technicianId || null;

    if (assignmentMode !== "NORMAL") noteParts.push(assignmentModeLabel(assignmentMode));

    if (body.poolId !== undefined) {
      const poolId = toNumber(body.poolId);
      if (!poolId) return res.status(400).json({ ok: false, error: "Piscina invalida" });
      const pool = await prisma.pool.findUnique({ where: { id: poolId }, select: { id: true, clientId: true } });
      if (!pool) return res.status(404).json({ ok: false, error: "Piscina nao encontrada" });
      data.poolId = poolId;
      data.clientId = pool.clientId;
    }

    if (body.technicianId !== undefined) {
      const technicianId = toNumber(body.technicianId) || null;
      if (technicianId) {
        const technician = await prisma.technician.findUnique({
          where: { id: technicianId },
          select: { id: true, name: true },
        });
        if (!technician) return res.status(404).json({ ok: false, error: "Tecnico nao encontrado" });
        nextTechnicianName = technician.name;
        data.technicianId = technician.id;
      } else {
        nextTechnicianName = null;
        data.technicianId = null;
      }
      technicianChanged = Number(current.technicianId || 0) !== Number(data.technicianId || 0);
      if (technicianChanged) {
        noteParts.push(`Tecnico alterado de ${current.technician?.name || current.technicianId || "sem tecnico"} para ${nextTechnicianName || "sem tecnico"}`);
      }
    }

    if (body.scheduledAt !== undefined) {
      const scheduledAt = toDate(body.scheduledAt);
      if (!scheduledAt) return res.status(400).json({ ok: false, error: "Data da visita invalida" });
      data.scheduledAt = scheduledAt;
      dateChanged = scheduledAt.getTime() !== new Date(current.scheduledAt || current.date).getTime();
      if (dateChanged) noteParts.push(`Data alterada para ${scheduledAt.toLocaleString("pt-PT")}`);
    }
    if (body.status !== undefined) data.status = String(body.status || "").trim().toUpperCase();
    if (body.visitType !== undefined) data.visitType = String(body.visitType || "ONE_OFF").trim() || "ONE_OFF";
    if (body.type !== undefined) data.type = String(body.type || "EXTRA_SERVICE").trim() || "EXTRA_SERVICE";
    if (body.notes !== undefined) data.notes = String(body.notes || "").trim() || null;
    if (body.internalNote !== undefined) data.internalNote = String(body.internalNote || "").trim() || null;
    if (body.operationNote !== undefined && String(body.operationNote || "").trim()) {
      noteParts.push(String(body.operationNote || "").trim());
    }

    if ((assignmentMode !== "NORMAL" || technicianChanged || dateChanged || noteParts.length) && body.internalNote === undefined) {
      const stamp = new Date().toLocaleString("pt-PT");
      data.internalNote = appendPlannerNote(current.internalNote, `${stamp} - ${noteParts.join(" | ")}`);
    }

    if (body.billingMode !== undefined || body.unitPrice !== undefined || body.totalPrice !== undefined || body.price !== undefined) {
      Object.assign(data, billingDataFromBody(body));
    }

    const updated = await prisma.extraVisit.update({
      where: { id },
      data,
      include: {
        pool: { include: { client: true } },
        client: true,
        technician: true,
      },
    });

    if (updated.status === "DONE") await appendToBilling(updated);

    return res.json({ ok: true, message: "Visita extra atualizada", extraVisit: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro ao atualizar visita extra" });
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  createExtraVisit,
  listExtraVisits,
  updateExtraVisitStatus,
  updateExtraVisit,
};

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
  if (!req.body?.status || Object.keys(req.body).some(key => key !== 'status')) return res.status(400).json({ok:false,error:'Indique apenas o estado da visita.'});
  return updateExtraVisit(req, res);
}

async function updateExtraVisit(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(new Error('Visita extra invalida'), {statusCode:400});
    }

    const result = await prisma.$transaction(async tx => {
    const billing = require('../services/extraVisitBillingService');
    const fail = require('../services/fieldWriteRequestService').fail;
    const before = await tx.extraVisit.findUnique({where:{id}});
    if (!before) fail('Visita extra não encontrada.',404);
    await billing.lockClient(tx,before);
    await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR UPDATE`;
    const body = req.body || {};
    const data = {};
    const current = await tx.extraVisit.findUnique({
      where: { id },
      include: { technician: true },
    });
    if (!current) throw Object.assign(new Error('Visita extra nao encontrada'), {statusCode:404});

    if (current.clientId !== before.clientId || current.poolId !== before.poolId) fail('A visita mudou. Atualize antes de editar.',409);
    const reserved = current.billed || !!(await tx.invoiceLine.findFirst({where:{type:'EXTRA_VISIT',referenceId:id}}));
    if (reserved && Object.entries(body).some(([key,value])=>key !== 'status' || value !== current.status)) fail('Visita já incluída em faturação. Conserve o documento e peça uma correção explícita.',409);
    const hasPhotos = await tx.extraVisitPhoto.count({where:{extraVisitId:id}});
    const terminal = ['DONE','COMPLETED','CONCLUIDA','CONCLUIDO','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(current.status) || !!current.endAt;
    if (terminal && Object.entries(body).some(([key,value]) => key !== 'status' || value !== current.status)) fail('Visita fechada. Conserve o histórico e utilize um processo de correção.',409);
    if ((current.startAt || hasPhotos) && ['poolId','technicianId','scheduledAt','billingMode','unitPrice','totalPrice','price'].some(key=>body[key]!==undefined)) fail('Visita iniciada. Confirme o registo antes de alterar atribuição, data ou condições comerciais.',409);
    if (body.status !== undefined && !['PLANNED','IN_PROGRESS','DONE','CANCELLED','SKIPPED'].includes(body.status)) fail('Estado inválido.');
    if (body.status === 'DONE' && Object.keys(body).some(key=>key !== 'status')) fail('Guarde as condições da visita antes de confirmar a conclusão.',409);
    const assignmentMode = normalizeAssignmentMode(body.assignmentMode);
    const noteParts = [];
    let technicianChanged = false;
    let dateChanged = false;
    let nextTechnicianName = current.technician?.name || current.technicianId || null;

    if (assignmentMode !== "NORMAL") noteParts.push(assignmentModeLabel(assignmentMode));

    if (body.poolId !== undefined) {
      const poolId = toNumber(body.poolId);
      if (!poolId) throw Object.assign(new Error('Piscina invalida'), {statusCode:400});
      const pool = await tx.pool.findUnique({ where: { id: poolId }, select: { id: true, clientId: true } });
      if (!pool) throw Object.assign(new Error('Piscina nao encontrada'), {statusCode:404});
      data.poolId = poolId;
      data.clientId = pool.clientId;
    }

    if (body.technicianId !== undefined) {
      const technicianId = toNumber(body.technicianId) || null;
      if (technicianId) {
        const technician = await tx.technician.findUnique({
          where: { id: technicianId },
          select: { id: true, name: true },
        });
        if (!technician) throw Object.assign(new Error('Tecnico nao encontrado'), {statusCode:404});
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
      if (!scheduledAt) throw Object.assign(new Error('Data da visita invalida'), {statusCode:400});
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

    if (body.status === 'IN_PROGRESS') data.startAt = current.startAt || new Date();
    if (body.status === 'DONE' && !terminal) { data.startAt = current.startAt || new Date(); data.endAt = new Date(); }
    const updated = await tx.extraVisit.update({
      where: { id },
      data,
      include: {
        pool: { include: { client: true } },
        client: true,
        technician: true,
      },
    });

    if (updated.status === 'DONE') await billing.record(tx,updated);
    if (!terminal) await tx.auditTrail.create({data:{eventType:'EXTRA_VISIT_ADMIN_UPDATED',entity:'ExtraVisit',entityId:id,poolId:updated.poolId,clientId:updated.clientId,action:'EXTRA_VISIT_ADMIN_UPDATED',metadata:{owner:require('../services/fieldWriteRequestService').owner(req.user),status:updated.status}}});
    return tx.extraVisit.findUnique({where:{id},include:{pool:{include:{client:true}},client:true,technician:true}});
    }, {maxWait:15000,timeout:20000});
    return res.json({ ok: true, message: 'Visita extra atualizada', extraVisit: result });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({ok:false,error:err.statusCode ? err.message : 'Não foi possível confirmar a alteração. Atualize antes de repetir.'});
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

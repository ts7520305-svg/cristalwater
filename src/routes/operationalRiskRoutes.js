const express = require("express");

const { prisma } = require("../prismaClient");
const ruleService=require("../services/operationalRiskRulesReviewService");
const ruleContract=require("../../frontend/cw-operational-risk-rules");

const router = express.Router();

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function fmtDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-PT");
}

function issueId(parts) {
  return parts.filter((part) => part !== undefined && part !== null && part !== "").join(":");
}

function addIssue(issues, data) {
  issues.push({
    id: data.id || issueId([data.type, data.targetType, data.targetId, data.vehicleId, data.technicianId, data.clientId]),
    type: data.type,
    severity: data.severity || "WARNING",
    targetType: data.targetType,
    targetId: data.targetId == null ? null : Number(data.targetId),
    vehicleId: data.vehicleId == null ? null : Number(data.vehicleId),
    technicianId: data.technicianId == null ? null : Number(data.technicianId),
    clientId: data.clientId == null ? null : Number(data.clientId),
    title: data.title || "Atencao",
    message: data.message || "",
    href: data.href || null,
    source: data.source || "RISK_ENGINE",
    createdAt: data.createdAt || new Date().toISOString(),
  });
}

function groupBy(issues, key) {
  return issues.reduce((acc, item) => {
    const value = item[key];
    if (value !== undefined && value !== null) {
      const mapKey = String(value);
      if (!acc[mapKey]) acc[mapKey] = [];
      acc[mapKey].push(item);
    }
    return acc;
  }, {});
}

function isInsurance(record) {
  const raw = normalizeText(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`);
  return /seguro|apolice|apol/.test(raw);
}

function isInspection(record) {
  const raw = normalizeText(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`);
  return /inspecao|inspec|ipo|vistoria/.test(raw);
}

function latestRelevantRecord(records, vehicleId, predicate) {
  return records
    .filter((record) => Number(record.vehicleId) === Number(vehicleId) && predicate(record))
    .sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return bd - ad || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0] || null;
}

async function transportDocumentsByGuideId(guides) {
  const guideIds = guides.map((guide) => guide.id).filter(Boolean);
  if (!guideIds.length) return new Map();
  const keys = guideIds.map((id) => `transport_guide_at_document_${id}`);
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  const docs = new Map();
  settings.forEach((setting) => {
    try {
      const parsed = JSON.parse(setting.value || "{}");
      if (parsed?.guideId && parsed?.url) docs.set(Number(parsed.guideId), parsed);
    } catch (_) {}
  });
  return docs;
}

function addVehicleIssueToTechnicians(issues, vehicle, sourceIssue, rules) {
  if (!rules.technicianLinkedVehicleIssues) return;
  for (const technician of vehicle.assignedTechnicians || []) {
    if (technician.active === false) continue;
    addIssue(issues, {
      ...sourceIssue,
      id: issueId(["TECHNICIAN_LINK", sourceIssue.id, technician.id]),
      type: "TECHNICIAN_LINKED_VEHICLE_RISK",
      targetType: "Technician",
      targetId: technician.id,
      technicianId: technician.id,
      vehicleId: vehicle.id,
      title: `Viatura ${vehicle.plate}: ${sourceIssue.title}`,
      message: sourceIssue.message,
      href: "/admin-vehicles",
      source: "VEHICLE_RISK",
    });
  }
}

async function buildOperationalRiskSummary() {
  const {rules,rulesState,defaultKeys} = await ruleService.effective();
  const issues = [];
  const now = new Date();

  const vehicles = await prisma.vehicle.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { plate: "asc" },
    include: {
      assignedTechnicians: {
        select: { id: true, name: true, email: true, active: true, vehicleId: true },
      },
    },
  });
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);

  const [activeGuides, openWorks, maintenanceRecords, pendingLocks] = await Promise.all([
    prisma.transportGuide.findMany({
      where: { vehicleId: { in: vehicleIds }, status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }],
      include: { items: true, vehicle: true },
    }),
    prisma.workGuide.findMany({
      where: { vehicleId: { in: vehicleIds }, status: "OPEN" },
      orderBy: [{ createdAt: "desc" }],
      include: { items: true, guide: true, technician: true, vehicle: true },
    }),
    prisma.vehicleMaintenanceRecord.findMany({
      where: {
        vehicleId: { in: vehicleIds },
        status: { notIn: ["COMPLETED", "DONE", "RESOLVED", "CLOSED"] },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.operationalLock.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const documents = await transportDocumentsByGuideId(activeGuides);
  const activeGuideByVehicle = new Map();
  activeGuides.forEach((guide) => {
    if (!activeGuideByVehicle.has(guide.vehicleId)) activeGuideByVehicle.set(guide.vehicleId, guide);
  });

  const openWorkByVehicle = new Map();
  openWorks.forEach((workGuide) => {
    if (!openWorkByVehicle.has(workGuide.vehicleId)) openWorkByVehicle.set(workGuide.vehicleId, workGuide);
  });

  for (const vehicle of vehicles) {
    const activeGuide = activeGuideByVehicle.get(vehicle.id) || null;
    const openWork = openWorkByVehicle.get(vehicle.id) || null;
    const assignedTechs = (vehicle.assignedTechnicians || []).filter((tech) => tech.active !== false);
    const vehicleLabel = vehicle.plate || `Viatura ${vehicle.id}`;

    if (rules.missingTransportGuide) {
      let vehicleIssue = null;
      if (openWork && !openWork.guideId) {
        vehicleIssue = {
          type: "MISSING_TRANSPORT_GUIDE",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          technicianId: openWork.technicianId || null,
          title: "Guia AT em falta",
          message: `Falta guia de transporte AT para ${vehicleLabel}. A guia de obra #${openWork.id} esta provisoria.`,
          href: "/admin-vehicles",
        };
      } else if (assignedTechs.length && !activeGuide) {
        vehicleIssue = {
          type: "MISSING_TRANSPORT_GUIDE",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Sem guia AT ativa",
          message: `${vehicleLabel} tem tecnico associado mas nao tem guia de transporte AT ativa.`,
          href: "/admin-vehicles",
        };
      }
      if (vehicleIssue) {
        addIssue(issues, vehicleIssue);
        addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
      }
    }

    if (rules.missingTransportGuideDocument && activeGuide && !documents.has(activeGuide.id)) {
      const vehicleIssue = {
        type: "MISSING_TRANSPORT_GUIDE_DOCUMENT",
        severity: "WARNING",
        targetType: "TransportGuide",
        targetId: activeGuide.id,
        vehicleId: vehicle.id,
        title: "Ficheiro AT oficial em falta",
        message: `${vehicleLabel} tem guia AT ${activeGuide.codeAT || `#${activeGuide.id}`} sem ficheiro oficial anexado.`,
        href: "/admin-vehicles",
      };
      addIssue(issues, vehicleIssue);
      addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
    }

    if (rules.missingWorkGuide && (activeGuide || assignedTechs.length) && !openWork) {
      const vehicleIssue = {
        type: "MISSING_WORK_GUIDE",
        severity: "WARNING",
        targetType: "Vehicle",
        targetId: vehicle.id,
        vehicleId: vehicle.id,
        title: "Guia de obra em falta",
        message: `${vehicleLabel} ainda nao tem guia de obra aberta para o dia/ronda atual.`,
        href: "/admin-vehicles",
      };
      addIssue(issues, vehicleIssue);
      addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
    }

    if (rules.vehicleInsuranceExpiring) {
      const insurance = latestRelevantRecord(maintenanceRecords, vehicle.id, isInsurance);
      const left = daysUntil(insurance?.dueDate);
      let vehicleIssue = null;
      if (!insurance) {
        vehicleIssue = {
          type: "VEHICLE_INSURANCE_MISSING",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Seguro nao registado",
          message: `${vehicleLabel} nao tem seguro registado no sistema.`,
          href: "/admin-vehicles",
        };
      } else if (left !== null && left < 0) {
        vehicleIssue = {
          type: "VEHICLE_INSURANCE_OVERDUE",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Seguro expirado",
          message: `${vehicleLabel} tem seguro expirado desde ${fmtDate(insurance.dueDate)}.`,
          href: "/admin-vehicles",
        };
      } else if (left !== null && left <= rules.insuranceWarningDays) {
        vehicleIssue = {
          type: "VEHICLE_INSURANCE_EXPIRING",
          severity: "WARNING",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Seguro a acabar",
          message: `${vehicleLabel} tem seguro a acabar em ${left} dia(s), em ${fmtDate(insurance.dueDate)}.`,
          href: "/admin-vehicles",
        };
      }
      if (vehicleIssue) {
        addIssue(issues, vehicleIssue);
        addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
      }
    }

    if (rules.vehicleInspectionExpiring) {
      const inspection = latestRelevantRecord(maintenanceRecords, vehicle.id, isInspection);
      const left = daysUntil(inspection?.dueDate);
      let vehicleIssue = null;
      if (!inspection) {
        vehicleIssue = {
          type: "VEHICLE_INSPECTION_MISSING",
          severity: "WARNING",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Inspecao nao registada",
          message: `${vehicleLabel} nao tem inspecao/IPO registada no sistema.`,
          href: "/admin-vehicles",
        };
      } else if (left !== null && left < 0) {
        vehicleIssue = {
          type: "VEHICLE_INSPECTION_OVERDUE",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Inspecao vencida",
          message: `${vehicleLabel} tem inspecao vencida desde ${fmtDate(inspection.dueDate)}.`,
          href: "/admin-vehicles",
        };
      } else if (left !== null && left <= rules.inspectionWarningDays) {
        vehicleIssue = {
          type: "VEHICLE_INSPECTION_EXPIRING",
          severity: "WARNING",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Inspecao a acabar",
          message: `${vehicleLabel} tem inspecao a acabar em ${left} dia(s), em ${fmtDate(inspection.dueDate)}.`,
          href: "/admin-vehicles",
        };
      }
      if (vehicleIssue) {
        addIssue(issues, vehicleIssue);
        addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
      }
    }

    if (rules.lowVehicleStock && openWork) {
      const lowItems = (openWork.items || []).filter((item) => Number(item.quantity || 0) <= rules.stockLowThreshold);
      if (!(openWork.items || []).length) {
        const vehicleIssue = {
          type: "VEHICLE_STOCK_EMPTY",
          severity: "WARNING",
          targetType: "WorkGuide",
          targetId: openWork.id,
          vehicleId: vehicle.id,
          technicianId: openWork.technicianId || null,
          title: "Stock da viatura sem linhas",
          message: `${vehicleLabel} tem guia de obra aberta mas sem material carregado.`,
          href: "/admin-vehicles",
        };
        addIssue(issues, vehicleIssue);
        addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
      } else if (lowItems.length) {
        const names = lowItems.slice(0, 5).map((item) => `${item.name} (${item.quantity} ${item.unit || "UN"})`).join(", ");
        const vehicleIssue = {
          type: "VEHICLE_STOCK_LOW",
          severity: lowItems.some((item) => Number(item.quantity || 0) <= 0) ? "CRITICAL" : "WARNING",
          targetType: "WorkGuide",
          targetId: openWork.id,
          vehicleId: vehicle.id,
          technicianId: openWork.technicianId || null,
          title: "Material baixo/em falta",
          message: `${vehicleLabel} tem material baixo ou em falta: ${names}.`,
          href: "/admin-vehicles",
        };
        addIssue(issues, vehicleIssue);
        addVehicleIssueToTechnicians(issues, vehicle, vehicleIssue, rules);
      }
    }
  }

  if (rules.pendingOperationalLocks) {
    for (const lock of pendingLocks) {
      addIssue(issues, {
        id: issueId(["LOCK", lock.id]),
        type: lock.lockType || "OPERATIONAL_LOCK",
        severity: lock.severity || "WARNING",
        targetType: lock.entity || "OperationalLock",
        targetId: lock.entityId || lock.id,
        vehicleId: lock.vehicleId,
        technicianId: lock.technicianId,
        clientId: lock.clientId,
        title: lock.title || "Pendencia operacional",
        message: lock.message || "Existe uma pendencia operacional por resolver.",
        href: lock.vehicleId ? "/admin-vehicles" : "/admin-alerts",
        source: "OPERATIONAL_LOCK",
        createdAt: lock.createdAt,
      });
    }
  }

  if (rules.overduePayments) {
    const invoices = await prisma.invoice.findMany({
      where: {
        amountOpen: { gt: 0 },
        OR: [
          { status: { in: ["OVERDUE", "EM_ATRASO", "ATRASO", "VENCIDA"] } },
          { dueDate: { lt: now } },
        ],
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 500,
    });

    for (const invoice of invoices) {
      addIssue(issues, {
        id: issueId(["OVERDUE_PAYMENT", invoice.id]),
        type: "OVERDUE_PAYMENT",
        severity: "CRITICAL",
        targetType: "Client",
        targetId: invoice.clientId,
        clientId: invoice.clientId,
        title: "Pagamento em atraso",
        message: `${invoice.client?.name || `Cliente ${invoice.clientId}`} tem ${Number(invoice.amountOpen || 0).toFixed(2)} EUR em aberto.`,
        href: `/admin-clients?search=${encodeURIComponent(invoice.client?.name || invoice.clientId)}`,
        source: "INVOICE",
        createdAt: invoice.createdAt,
      });
    }
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    rules,
    rulesState,
    defaultKeys,
    counts: {
      total: issues.length,
      critical: issues.filter((item) => item.severity === "CRITICAL").length,
      warning: issues.filter((item) => item.severity !== "CRITICAL").length,
    },
    issues,
    byVehicleId: groupBy(issues, "vehicleId"),
    byTechnicianId: groupBy(issues, "technicianId"),
    byClientId: groupBy(issues, "clientId"),
  };
}

router.use(require('../middlewares/authMiddleware')('ADMIN'));
router.get('/rules',async(req,res)=>{res.set('Cache-Control','private, no-store');try{res.json({ok:true,...await ruleService.effective(),defaults:ruleContract.defaults});}catch(e){res.status(e.statusCode||503).json({ok:false,code:e.code==='RISK_RULES_DATA_REVIEW'?e.code:'RISK_RULES_UNAVAILABLE'});}});
router.put('/rules',require('../controllers/operationalRiskRulesReviewController').legacy);
router.get('/summary',async(req,res)=>{res.set('Cache-Control','private, no-store');try{res.json(await buildOperationalRiskSummary());}catch(e){res.status(e.statusCode||503).json({ok:false,code:e.code==='RISK_RULES_DATA_REVIEW'?e.code:'RISK_SUMMARY_UNAVAILABLE'});}});
module.exports=router;

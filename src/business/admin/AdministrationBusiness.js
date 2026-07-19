const Kernel = require("../../core/Kernel");
const { roleIn } = require("../../utils/roles");
const repository = require("../../dal/AdministrationRepository");
const FinanceBusiness = require("../finance/FinanceOsBusiness");
const EquipmentStockBusiness = require("../operations/EquipmentStockOsBusiness");
const { EVENT_TYPES, emitAdministrationEvent } = require("../../services/administrationEventService");

const WORKFLOW_LOCK_TYPE = "ADMINISTRATION_WORKFLOW";

const STEP_ROLE_RULES = {
  createModule: ["ADMIN", "TEAM_LEADER"],
  updateHr: ["ADMIN", "TEAM_LEADER"],
  updateVehicles: ["ADMIN", "TEAM_LEADER"],
  updateFleet: ["ADMIN", "TEAM_LEADER"],
  registerPurchase: ["ADMIN", "TEAM_LEADER"],
  updateSuppliers: ["ADMIN", "TEAM_LEADER"],
  updateInternalTasks: ["ADMIN", "TEAM_LEADER"],
  updateKpis: ["ADMIN", "TEAM_LEADER"],
  updateCompanyDashboard: ["ADMIN", "TEAM_LEADER"],
  updateProductivity: ["ADMIN", "TEAM_LEADER"],
  registerVacation: ["ADMIN", "TEAM_LEADER"],
  registerAbsence: ["ADMIN", "TEAM_LEADER"],
  sendInternalMessage: ["ADMIN", "TEAM_LEADER", "TECHNICIAN"],
  registerApproval: ["ADMIN", "TEAM_LEADER"],
  updateCompanyReports: ["ADMIN", "TEAM_LEADER"],
  registerAudit: ["ADMIN", "TEAM_LEADER"],
  sendNotification: ["ADMIN", "TEAM_LEADER"],
  completeModule: ["ADMIN", "TEAM_LEADER"],
};

function text(value) {
  return String(value || "").trim();
}

function asMoney(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRatio(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(parsed, 100));
}

function monthRefFromDate(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function workflowPayload(lock) {
  return lock?.payload && typeof lock.payload === "object" ? lock.payload : {};
}

function metricIncrement(name) {
  try {
    if (Kernel?.Metrics?.increment) Kernel.Metrics.increment(name, 1);
  } catch (_) {
    return null;
  }
  return null;
}

function ensurePermission(step, actorRole) {
  const allowed = STEP_ROLE_RULES[step] || ["ADMIN"];
  if (!roleIn(actorRole || "", allowed)) {
    return { ok: false, status: 403, error: "Sem permissão" };
  }
  return { ok: true };
}

async function logStep(tx, moduleState, step, actorCtx, eventType, message, metadata = {}) {
  const payload = workflowPayload(moduleState);
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  const nextTimeline = [
    ...timeline,
    {
      step,
      actor: actorCtx.actor,
      role: actorCtx.role,
      at: nowIso(),
    },
  ];

  await repository.updateWorkflow(tx, moduleState.id, {
    message,
    payload: {
      ...payload,
      currentStep: step,
      timeline: nextTimeline,
      ...metadata,
    },
  });

  await repository.createAudit(tx, {
    action: eventType,
    eventType,
    entity: "AdministrationModule",
    entityId: moduleState.id,
    metadata: {
      actor: actorCtx.actor,
      role: actorCtx.role,
      step,
      ...metadata,
    },
    message,
  });

  metricIncrement(`administration.${step}`);

  await emitAdministrationEvent(eventType, {
    moduleId: moduleState.id,
    step,
    actor: actorCtx.actor,
    source: "administration-business",
  });
}

async function getModule(moduleId) {
  const moduleState = await repository.getWorkflow(moduleId);
  if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
    return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
  }
  return { ok: true, module: moduleState };
}

async function createModule(payload = {}, actorCtx = {}) {
  const permission = ensurePermission("createModule", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const created = await repository.createWorkflow(tx, {
      lockType: WORKFLOW_LOCK_TYPE,
      severity: "WARNING",
      status: "APPROVED",
      entity: "AdministrationModule",
      entityId: null,
      title: text(payload.title || "Administration OS") || "Administration OS",
      message: "Módulo de administração iniciado",
      requestedBy: actorCtx.actor,
      approvedBy: actorCtx.actor,
      approvedAt: new Date(),
      payload: {
        workflow: "ADMINISTRATION_OS",
        status: "MODULE_CREATED",
        startedAt: nowIso(),
        timeline: [],
      },
    });

    await repository.updateWorkflow(tx, created.id, { entityId: created.id });
    await logStep(tx, created, "MODULE_CREATED", actorCtx, EVENT_TYPES.ADMINISTRATION_MODULE_CREATED, "Módulo de administração criado");

    const final = await repository.getWorkflow(created.id, tx);
    return { ok: true, module: final };
  });
}

async function applyStep(moduleId, payload = {}, actorCtx = {}, options = {}) {
  const permission = ensurePermission(options.permissionKey, actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const state = workflowPayload(moduleState);
    const nextState = {
      ...state,
      status: options.nextStatus || state.status,
      ...(typeof options.transformState === "function" ? options.transformState(state, payload) : {}),
    };

    await logStep(tx, moduleState, options.step, actorCtx, options.eventType, options.message, nextState);

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final };
  });
}

async function updateHr(moduleId, payload = {}, actorCtx = {}) {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "updateHr",
    step: "HR",
    nextStatus: "HR_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_HR_UPDATED,
    message: "Registo de RH atualizado",
    transformState: () => ({ hr: { entries, notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function updateVehicles(moduleId, payload = {}, actorCtx = {}) {
  const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];
  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    for (const vehicle of vehicles) {
      await repository.upsertVehicle(tx, {
        plate: text(vehicle.plate),
        name: text(vehicle.name) || null,
        brand: text(vehicle.brand) || null,
        model: text(vehicle.model) || null,
        year: vehicle.year == null ? null : Number(vehicle.year),
        currentKm: vehicle.currentKm == null ? null : Number(vehicle.currentKm),
        status: text(vehicle.status || "ACTIVE") || "ACTIVE",
        active: vehicle.active === false ? false : true,
        notes: text(vehicle.notes) || null,
      });
    }

    const dbVehicles = await repository.listVehicles(tx);

    await logStep(tx, moduleState, "VEHICLES", actorCtx, EVENT_TYPES.ADMINISTRATION_VEHICLES_UPDATED, "Gestão de viaturas atualizada", {
      vehicles: dbVehicles,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, vehicles: dbVehicles };
  });
}

async function updateFleet(moduleId, payload = {}, actorCtx = {}) {
  const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance : [];

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    for (const item of maintenance) {
      await repository.createVehicleMaintenance(tx, {
        vehicleId: item.vehicleId == null ? null : Number(item.vehicleId) || null,
        type: text(item.type || "GENERAL") || "GENERAL",
        title: text(item.title || "Fleet Maintenance") || "Fleet Maintenance",
        status: text(item.status || "PENDING") || "PENDING",
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        km: item.km == null ? null : Number(item.km),
        cost: item.cost == null ? null : Number(item.cost),
        notes: text(item.notes) || null,
      });
    }

    const records = await repository.listVehicleMaintenance(tx, 200);

    await logStep(tx, moduleState, "FLEET", actorCtx, EVENT_TYPES.ADMINISTRATION_FLEET_UPDATED, "Gestão de frota atualizada", {
      fleet: {
        maintenanceRecords: records,
      },
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, fleet: records };
  });
}

async function registerPurchase(moduleId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("registerPurchase", actorCtx.role);
  if (!permission.ok) return permission;

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { ok: false, status: 400, error: "items obrigatórios" };

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const purchase = await repository.createPurchase(tx, {
      supplierName: text(payload.supplierName) || null,
      supplierId: payload.supplierId == null ? null : Number(payload.supplierId) || null,
      invoiceNumber: text(payload.invoiceNumber) || null,
      invoiceDate: payload.invoiceDate ? new Date(payload.invoiceDate) : null,
      totalAmount: asMoney(payload.totalAmount || items.reduce((sum, item) => sum + asMoney(item.totalCost || asMoney(item.quantity) * asMoney(item.unitCost)), 0)),
      status: text(payload.status || "POSTED") || "POSTED",
      notes: text(payload.notes) || null,
      createdBy: actorCtx.actor,
      items: {
        create: items.map((item) => ({
          productId: item.productId == null ? null : Number(item.productId) || null,
          productName: text(item.productName || "Produto") || "Produto",
          category: text(item.category || "CHEMICAL") || "CHEMICAL",
          unit: text(item.unit || "KG") || "KG",
          quantity: asMoney(item.quantity),
          unitCost: asMoney(item.unitCost),
          totalCost: asMoney(item.totalCost || asMoney(item.quantity) * asMoney(item.unitCost)),
          lot: text(item.lot) || null,
          notes: text(item.notes) || null,
        })),
      },
    });

    await logStep(tx, moduleState, "PURCHASES", actorCtx, EVENT_TYPES.ADMINISTRATION_PURCHASE_CREATED, "Compra registada", {
      lastPurchase: purchase,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, purchase };
  });
}

async function updateSuppliers(moduleId, payload = {}, actorCtx = {}) {
  const suppliers = Array.isArray(payload.suppliers) ? payload.suppliers : [];

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    for (const supplier of suppliers) {
      const id = supplier.id == null ? null : Number(supplier.id) || null;
      const data = {
        name: text(supplier.name || "Fornecedor") || "Fornecedor",
        category: text(supplier.category) || null,
        phone: text(supplier.phone) || null,
        email: text(supplier.email) || null,
        notes: text(supplier.notes) || null,
        favorite: supplier.favorite === true,
        active: supplier.active === false ? false : true,
      };

      if (id) {
        await repository.updateSupplierAccount(tx, id, data).catch(() => null);
      } else {
        await repository.createSupplierAccount(tx, data);
      }
    }

    const allSuppliers = await repository.listSuppliers(tx);

    await logStep(tx, moduleState, "SUPPLIERS", actorCtx, EVENT_TYPES.ADMINISTRATION_SUPPLIERS_UPDATED, "Fornecedores atualizados", {
      suppliers: allSuppliers,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, suppliers: allSuppliers };
  });
}

async function updateInternalTasks(moduleId, payload = {}, actorCtx = {}) {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    for (const task of tasks) {
      await repository.createTask(tx, {
        title: text(task.title || "Tarefa interna") || "Tarefa interna",
        description: text(task.description) || null,
        priority: text(task.priority || "NORMAL") || "NORMAL",
        status: text(task.status || "PENDENTE") || "PENDENTE",
        technicianId: task.technicianId == null ? null : Number(task.technicianId) || null,
      });
    }

    const allTasks = await repository.listTasks(tx, 200);

    await logStep(tx, moduleState, "INTERNAL_TASKS", actorCtx, EVENT_TYPES.ADMINISTRATION_INTERNAL_TASKS_UPDATED, "Tarefas internas atualizadas", {
      internalTasks: allTasks,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, tasks: allTasks };
  });
}

async function updateKpis(moduleId, payload = {}, actorCtx = {}) {
  const monthRef = text(payload.monthRef) || monthRefFromDate();
  const [companyBalance, revenue, stockDashboard] = await Promise.all([
    FinanceBusiness.getCompanyBalance().catch(() => ({ ok: false })),
    FinanceBusiness.getRevenueReport({ monthRef }).catch(() => ({ ok: false })),
    EquipmentStockBusiness.buildOperationalDashboard().catch(() => ({ ok: false })),
  ]);

  const kpis = {
    monthRef,
    companyBalance: companyBalance.ok ? companyBalance.balance : null,
    revenue: revenue.ok ? revenue.report : null,
    stock: stockDashboard.ok ? stockDashboard.dashboard : null,
    productivityScore: asRatio(payload.productivityScore || 0),
    tasksOpen: Number(payload.tasksOpen || 0),
    absencesOpen: Number(payload.absencesOpen || 0),
    vacationsPlanned: Number(payload.vacationsPlanned || 0),
    at: nowIso(),
  };

  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "updateKpis",
    step: "KPIS",
    nextStatus: "KPIS_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_KPIS_UPDATED,
    message: "KPIs corporativos atualizados",
    transformState: () => ({ kpis }),
  });
}

async function updateCompanyDashboard(moduleId, payload = {}, actorCtx = {}) {
  const monthRef = text(payload.monthRef) || monthRefFromDate();
  const [vehicles, suppliers, purchases, tasks, notifications] = await Promise.all([
    repository.listVehicles(),
    repository.listSuppliers(),
    repository.listPurchases(undefined, 50),
    repository.listTasks(undefined, 200),
    repository.listNotifications(undefined, 200),
  ]);

  const dashboard = {
    monthRef,
    vehiclesTotal: vehicles.length,
    vehiclesActive: vehicles.filter((item) => item.active).length,
    suppliersTotal: suppliers.length,
    purchasesTotal: purchases.length,
    purchasesPosted: purchases.filter((item) => String(item.status || "").toUpperCase() === "POSTED").length,
    internalTasksOpen: tasks.filter((item) => !String(item.status || "").toUpperCase().includes("DONE") && !String(item.status || "").toUpperCase().includes("CONCL")).length,
    notificationsPending: notifications.filter((item) => !item.isRead).length,
    updatedAt: nowIso(),
  };

  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "updateCompanyDashboard",
    step: "DASHBOARD",
    nextStatus: "DASHBOARD_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_DASHBOARD_UPDATED,
    message: "Dashboard corporativo atualizado",
    transformState: () => ({ companyDashboard: dashboard }),
  });
}

async function updateProductivity(moduleId, payload = {}, actorCtx = {}) {
  const monthRef = text(payload.monthRef) || monthRefFromDate();
  const [visits, workDays, techs] = await Promise.all([
    repository.listVisitsByMonth(monthRef),
    repository.listWorkDaysByMonth(monthRef),
    repository.listTechnicians(),
  ]);

  const doneVisits = visits.filter((visit) => {
    const status = String(visit.status || "").toUpperCase();
    return status.includes("DONE") || status.includes("CONCL");
  }).length;

  const activeWorkDays = workDays.filter((item) => String(item.status || "").toUpperCase() === "ACTIVE").length;
  const productivity = {
    monthRef,
    technicians: techs.length,
    visitsPlanned: visits.length,
    visitsDone: doneVisits,
    activeWorkDays,
    completionRate: visits.length > 0 ? Number(((doneVisits / visits.length) * 100).toFixed(2)) : 0,
    visitsPerTechnician: techs.length > 0 ? Number((doneVisits / techs.length).toFixed(2)) : 0,
    calculatedAt: nowIso(),
  };

  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "updateProductivity",
    step: "PRODUCTIVITY",
    nextStatus: "PRODUCTIVITY_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_PRODUCTIVITY_UPDATED,
    message: "Produtividade atualizada",
    transformState: () => ({ productivity }),
  });
}

async function registerVacation(moduleId, payload = {}, actorCtx = {}) {
  const item = {
    technicianId: payload.technicianId == null ? null : Number(payload.technicianId) || null,
    startDate: text(payload.startDate) || null,
    endDate: text(payload.endDate) || null,
    reason: text(payload.reason) || null,
    status: text(payload.status || "APPROVED") || "APPROVED",
    createdBy: actorCtx.actor,
    createdAt: nowIso(),
  };

  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "registerVacation",
    step: "VACATION",
    nextStatus: "VACATION_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_VACATION_REGISTERED,
    message: "Férias registadas",
    transformState: (state) => ({
      vacations: [...(Array.isArray(state.vacations) ? state.vacations : []), item],
    }),
  });
}

async function registerAbsence(moduleId, payload = {}, actorCtx = {}) {
  const item = {
    technicianId: payload.technicianId == null ? null : Number(payload.technicianId) || null,
    date: text(payload.date) || null,
    reason: text(payload.reason) || null,
    status: text(payload.status || "OPEN") || "OPEN",
    createdBy: actorCtx.actor,
    createdAt: nowIso(),
  };

  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "registerAbsence",
    step: "ABSENCE",
    nextStatus: "ABSENCE_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_ABSENCE_REGISTERED,
    message: "Ausência registada",
    transformState: (state) => ({
      absences: [...(Array.isArray(state.absences) ? state.absences : []), item],
    }),
  });
}

async function sendInternalMessage(moduleId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("sendInternalMessage", actorCtx.role);
  if (!permission.ok) return permission;

  const message = text(payload.message || payload.text);
  if (!message) return { ok: false, status: 400, error: "message obrigatório" };

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const chat = await repository.createChatMessage(tx, {
      senderId: payload.senderId == null ? null : Number(payload.senderId) || null,
      receiverId: payload.receiverId == null ? null : Number(payload.receiverId) || null,
      chatType: text(payload.chatType || "INTERNAL") || "INTERNAL",
      channel: text(payload.channel || "ADMIN_INTERNAL") || "ADMIN_INTERNAL",
      text: message,
      message: message,
      messageType: text(payload.messageType || "TEXT") || "TEXT",
    });

    await logStep(tx, moduleState, "INTERNAL_MESSAGING", actorCtx, EVENT_TYPES.ADMINISTRATION_MESSAGE_SENT, "Mensagem interna enviada", {
      internalMessage: chat,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, message: chat };
  });
}

async function registerApproval(moduleId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("registerApproval", actorCtx.role);
  if (!permission.ok) return permission;

  const approvalTitle = text(payload.title || "Approval");
  if (!approvalTitle) return { ok: false, status: 400, error: "title obrigatório" };

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const approval = await repository.createWorkflow(tx, {
      lockType: "ADMIN_APPROVAL",
      severity: text(payload.severity || "WARNING") || "WARNING",
      status: text(payload.status || "APPROVED") || "APPROVED",
      entity: "AdministrationModule",
      entityId: moduleState.id,
      title: approvalTitle,
      message: text(payload.message || "Aprovação interna") || "Aprovação interna",
      requestedBy: actorCtx.actor,
      approvedBy: text(payload.approvedBy || actorCtx.actor) || actorCtx.actor,
      approvedAt: new Date(),
      payload: {
        type: text(payload.type || "GENERAL") || "GENERAL",
        notes: text(payload.notes) || null,
      },
    });

    await logStep(tx, moduleState, "APPROVALS", actorCtx, EVENT_TYPES.ADMINISTRATION_APPROVAL_REGISTERED, "Aprovação registada", {
      lastApproval: {
        id: approval.id,
        title: approval.title,
        status: approval.status,
      },
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, approval };
  });
}

async function updateCompanyReports(moduleId, payload = {}, actorCtx = {}) {
  const monthRef = text(payload.monthRef) || monthRefFromDate();
  const [companyBalance, revenue, techProfitability, customerProfitability, purchases, audit] = await Promise.all([
    FinanceBusiness.getCompanyBalance().catch(() => ({ ok: false })),
    FinanceBusiness.getRevenueReport({ monthRef }).catch(() => ({ ok: false })),
    FinanceBusiness.getTechnicianProfitabilityReport({ monthRef }).catch(() => ({ ok: false })),
    FinanceBusiness.getCustomerProfitabilityReport({ monthRef }).catch(() => ({ ok: false })),
    repository.listPurchases(undefined, 100),
    repository.listAudit(undefined, 200),
  ]);

  const report = {
    monthRef,
    companyBalance: companyBalance.ok ? companyBalance.balance : null,
    revenue: revenue.ok ? revenue.report : null,
    technicianProfitability: techProfitability.ok ? techProfitability.technicians : [],
    customerProfitability: customerProfitability.ok ? customerProfitability.clients : [],
    purchases,
    recentAudit: audit,
    generatedAt: nowIso(),
  };

  return applyStep(moduleId, payload, actorCtx, {
    permissionKey: "updateCompanyReports",
    step: "COMPANY_REPORTS",
    nextStatus: "REPORTS_UPDATED",
    eventType: EVENT_TYPES.ADMINISTRATION_REPORT_UPDATED,
    message: "Relatórios corporativos atualizados",
    transformState: () => ({ companyReports: report }),
  });
}

async function registerAudit(moduleId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("registerAudit", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const created = await repository.createAudit(tx, {
      action: text(payload.action || "ADMIN_MANUAL_AUDIT") || "ADMIN_MANUAL_AUDIT",
      eventType: EVENT_TYPES.ADMINISTRATION_AUDIT_REGISTERED,
      entity: "AdministrationModule",
      entityId: moduleState.id,
      message: text(payload.message || "Audit manual") || "Audit manual",
      metadata: payload.metadata || {},
    });

    await logStep(tx, moduleState, "AUDIT", actorCtx, EVENT_TYPES.ADMINISTRATION_AUDIT_REGISTERED, "Audit administrativo registado", {
      auditId: created?.id || null,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, audit: created };
  });
}

async function sendNotification(moduleId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("sendNotification", actorCtx.role);
  if (!permission.ok) return permission;

  const message = text(payload.message);
  if (!message) return { ok: false, status: 400, error: "message obrigatório" };

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const notification = await repository.createNotification(tx, {
      userId: payload.userId == null ? null : Number(payload.userId) || null,
      clientId: payload.clientId == null ? null : Number(payload.clientId) || null,
      type: text(payload.type || "ADMIN_NOTICE") || "ADMIN_NOTICE",
      eventType: EVENT_TYPES.ADMINISTRATION_NOTIFICATION_SENT,
      title: text(payload.title || "Notificação administrativa") || "Notificação administrativa",
      message,
      role: text(payload.role || "ADMIN") || "ADMIN",
      severity: text(payload.severity || "INFO") || "INFO",
      status: text(payload.status || "PENDING") || "PENDING",
      metadata: payload.metadata || {},
    });

    await logStep(tx, moduleState, "NOTIFICATIONS", actorCtx, EVENT_TYPES.ADMINISTRATION_NOTIFICATION_SENT, "Notificação administrativa enviada", {
      notificationId: notification?.id || null,
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final, notification };
  });
}

async function completeModule(moduleId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("completeModule", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const moduleState = await repository.getWorkflow(moduleId, tx);
    if (!moduleState || moduleState.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Módulo de administração não encontrado" };
    }

    const state = workflowPayload(moduleState);
    const required = [
      ["hr", "HR pendente"],
      ["fleet", "Fleet pendente"],
      ["kpis", "KPIs pendentes"],
      ["companyDashboard", "Dashboard pendente"],
      ["companyReports", "Relatórios pendentes"],
    ];

    for (const [field, error] of required) {
      if (!state[field] && !payload.force) return { ok: false, status: 409, error };
    }

    await repository.updateWorkflow(tx, moduleState.id, {
      status: "RESOLVED",
      resolvedAt: new Date(),
      message: "Administration OS concluído",
      payload: {
        ...state,
        status: "COMPLETED",
        completedAt: nowIso(),
      },
    });

    const completedState = await repository.getWorkflow(moduleState.id, tx);

    await logStep(tx, completedState, "COMPLETED", actorCtx, EVENT_TYPES.ADMINISTRATION_COMPLETED, "Administration OS concluído", {
      status: "COMPLETED",
      completedAt: nowIso(),
      force: Boolean(payload.force),
    });

    const final = await repository.getWorkflow(moduleState.id, tx);
    return { ok: true, module: final };
  });
}

module.exports = {
  getModule,
  createModule,
  updateHr,
  updateVehicles,
  updateFleet,
  registerPurchase,
  updateSuppliers,
  updateInternalTasks,
  updateKpis,
  updateCompanyDashboard,
  updateProductivity,
  registerVacation,
  registerAbsence,
  sendInternalMessage,
  registerApproval,
  updateCompanyReports,
  registerAudit,
  sendNotification,
  completeModule,
};

const { prisma } = require("../prismaClient");
const { getSetting, setSetting } = require("./systemSettingService");

const POLICY_KEY = "ACCESS_PERMISSION_POLICY";
const HIERARCHY_KEY = "TEAM_LEADER_HIERARCHY";

const MODULES = [
  { key: "dashboard", label: "Dashboard", description: "Resumo operacional e avisos." },
  { key: "clients", label: "Clientes", description: "Fichas de clientes e contratos." },
  { key: "pools", label: "Piscinas/Jacuzzis", description: "Equipamentos, zonas e estado." },
  { key: "technicalSheets", label: "Fichas tecnicas", description: "Dados tecnicos e manutencao." },
  { key: "rounds", label: "Rondas", description: "Planeamento diario/semanal." },
  { key: "visits", label: "Visitas", description: "Servicos, correcao e historico." },
  { key: "alerts", label: "Alertas", description: "Problemas tecnicos e avisos." },
  { key: "repairs", label: "Reparacoes", description: "Intervencoes e tarefas." },
  { key: "stock", label: "Stock", description: "Produtos e material." },
  { key: "vehiclesGuides", label: "Viaturas e guias", description: "Viaturas, AT e guias de obra." },
  { key: "finance", label: "Financeiro", description: "Valores, dividas e conta corrente." },
  { key: "invoices", label: "Faturas", description: "Faturas internas e externas." },
  { key: "payments", label: "Pagamentos", description: "Pagamentos e comprovativos." },
  { key: "reports", label: "Relatorios", description: "Relatorios operacionais." },
  { key: "chat", label: "Mensagens", description: "Chat cliente/tecnico/admin." },
  { key: "gps", label: "GPS", description: "Mapa e localizacao em trabalho." },
  { key: "ai", label: "IA admin", description: "Assistente operacional." },
  { key: "settings", label: "Configuracoes", description: "Regras do sistema." },
  { key: "upgrade", label: "Upgrade/Rollback", description: "Atualizacoes e backups." },
];

const INFORMATION_TYPES = [
  { key: "clientContacts", label: "Contactos de clientes", description: "Telefone, email e morada." },
  { key: "clientFiscalData", label: "Dados fiscais", description: "NIF, morada fiscal e email fiscal." },
  { key: "financialValues", label: "Valores financeiros", description: "Mensalidades, dividas e extras." },
  { key: "invoicesPayments", label: "Faturas e pagamentos", description: "Faturas, recibos e comprovativos." },
  { key: "accessCodesKeys", label: "Chaves e codigos", description: "Codigos de portao, alarme e chaves." },
  { key: "internalNotes", label: "Notas internas", description: "Notas apenas da equipa." },
  { key: "gpsLocations", label: "Localizacao GPS", description: "Mapa, historico e rotas." },
  { key: "stockCosts", label: "Custos de stock", description: "Custos, margens e fornecedores." },
  { key: "supplierCredentials", label: "Credenciais fornecedores", description: "Links, users e passwords de fornecedores." },
  { key: "auditLogs", label: "Auditoria", description: "Logs de acoes e alteracoes." },
];

function keys(list) {
  return list.map((item) => item.key);
}

const DEFAULT_PERMISSION_POLICY = {
  version: 1,
  roles: {
    ADMIN: {
      label: "Administrador",
      moduleAccess: keys(MODULES),
      informationAccess: keys(INFORMATION_TYPES),
      canManageUsers: true,
      canManageHierarchy: true,
      canApproveSensitiveActions: true,
    },
    TEAM_LEADER: {
      label: "Chefe de equipa",
      moduleAccess: [
        "dashboard",
        "clients",
        "pools",
        "technicalSheets",
        "rounds",
        "visits",
        "alerts",
        "repairs",
        "stock",
        "vehiclesGuides",
        "reports",
        "chat",
        "gps",
      ],
      informationAccess: ["clientContacts", "accessCodesKeys", "internalNotes", "gpsLocations"],
      canManageUsers: false,
      canManageHierarchy: false,
      canApproveSensitiveActions: false,
    },
    TECHNICIAN: {
      label: "Tecnico",
      moduleAccess: ["visits", "alerts", "stock", "vehiclesGuides", "chat", "gps"],
      informationAccess: ["accessCodesKeys"],
      canManageUsers: false,
      canManageHierarchy: false,
      canApproveSensitiveActions: false,
    },
    CLIENT: {
      label: "Cliente",
      moduleAccess: ["chat"],
      informationAccess: [],
      canManageUsers: false,
      canManageHierarchy: false,
      canApproveSensitiveActions: false,
    },
  },
  rules: {
    techniciansCanReceiveExtraPermissions: true,
    sensitiveInformationRequiresAdminApproval: true,
    teamLeadersOnlySeeAssignedPoolsAndTechnicians: true,
  },
};

const DEFAULT_TEAM_HIERARCHY = {
  version: 1,
  leaders: [],
};

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function uniqueStrings(values = [], allowed = []) {
  const allowedSet = new Set(allowed);
  return Array.from(new Set((Array.isArray(values) ? values : []).map(String).filter((item) => allowedSet.has(item))));
}

function uniqueIds(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(Number).filter((item) => Number.isInteger(item) && item > 0)));
}

function mergeRole(base, incoming = {}) {
  return {
    ...base,
    ...incoming,
    moduleAccess: uniqueStrings(incoming.moduleAccess || base.moduleAccess, keys(MODULES)),
    informationAccess: uniqueStrings(incoming.informationAccess || incoming.infoAccess || base.informationAccess, keys(INFORMATION_TYPES)),
    canManageUsers: Boolean(incoming.canManageUsers ?? base.canManageUsers),
    canManageHierarchy: Boolean(incoming.canManageHierarchy ?? base.canManageHierarchy),
    canApproveSensitiveActions: Boolean(incoming.canApproveSensitiveActions ?? base.canApproveSensitiveActions),
  };
}

function mergePolicy(incoming = {}) {
  const roles = {};
  Object.entries(DEFAULT_PERMISSION_POLICY.roles).forEach(([role, base]) => {
    roles[role] = mergeRole(base, incoming.roles?.[role] || {});
  });
  return {
    ...DEFAULT_PERMISSION_POLICY,
    ...incoming,
    roles,
    rules: { ...DEFAULT_PERMISSION_POLICY.rules, ...(incoming.rules || {}) },
  };
}

function sanitizeHierarchy(incoming = {}) {
  const leaders = (Array.isArray(incoming.leaders) ? incoming.leaders : []).map((leader) => ({
    id: String(leader.id || `leader-${leader.technicianId || Date.now()}`),
    technicianId: Number(leader.technicianId || 0),
    name: String(leader.name || "").trim(),
    zone: String(leader.zone || "").trim(),
    technicianIds: uniqueIds(leader.technicianIds),
    poolIds: uniqueIds(leader.poolIds),
    active: leader.active !== false,
    notes: String(leader.notes || "").trim(),
    createdAt: leader.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })).filter((leader) => leader.technicianId > 0);

  return { ...DEFAULT_TEAM_HIERARCHY, ...incoming, leaders };
}

async function getPermissionPolicy() {
  return mergePolicy(safeJsonParse(await getSetting(POLICY_KEY, ""), {}));
}

async function savePermissionPolicy(policy, actor = "admin") {
  const merged = mergePolicy(policy || {});
  await setSetting(POLICY_KEY, JSON.stringify(merged), `Updated by ${actor}`);
  return merged;
}

async function getTeamHierarchy() {
  return sanitizeHierarchy(safeJsonParse(await getSetting(HIERARCHY_KEY, ""), {}));
}

async function saveTeamHierarchy(hierarchy, actor = "admin") {
  const clean = sanitizeHierarchy(hierarchy || {});
  await setSetting(HIERARCHY_KEY, JSON.stringify(clean), `Updated by ${actor}`);
  const leaderIds = clean.leaders.filter((leader) => leader.active).map((leader) => leader.technicianId);
  if (leaderIds.length) {
    await prisma.technician.updateMany({
      where: { id: { in: leaderIds } },
      data: { role: "TEAM_LEADER" },
    });
  }
  return clean;
}

async function getAccessControlSnapshot() {
  const [policy, hierarchy, technicians, pools] = await Promise.all([
    getPermissionPolicy(),
    getTeamHierarchy(),
    prisma.technician.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, zone: true, active: true, vehicleId: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.pool.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        zone: true,
        address: true,
        clientId: true,
        active: true,
        client: { select: { id: true, name: true, zone: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 1500,
    }),
  ]);

  return { modules: MODULES, informationTypes: INFORMATION_TYPES, policy, hierarchy, technicians, pools };
}

module.exports = {
  POLICY_KEY,
  HIERARCHY_KEY,
  MODULES,
  INFORMATION_TYPES,
  DEFAULT_PERMISSION_POLICY,
  DEFAULT_TEAM_HIERARCHY,
  getPermissionPolicy,
  savePermissionPolicy,
  getTeamHierarchy,
  saveTeamHierarchy,
  getAccessControlSnapshot,
};

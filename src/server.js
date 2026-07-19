require("./loadEnv")();

const express = require("express");

// Crystal Platform Runtime
const Kernel = require("./core/Kernel");
const KernelRuntime = require("./core/runtime/KernelRuntime");
KernelRuntime.start(Kernel);

const cors = require("cors");
const path = require("path");
const fs = require("fs");
const http = require("http");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const logger = require("./services/loggerService");
const auditMiddleware = require("./middlewares/auditMiddleware");
const errorHandlerMiddleware = require("./middlewares/errorHandlerMiddleware");
const { assertJwtSecretForStartup } = require("./utils/jwtSecret");
const { ensureUploadBaseDirReady, getUploadsPublicBasePath } = require("./config/uploadPath");

// Core routes
const systemRoutes = require("./routes/systemRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const technicianCrudRoutes = require("./routes/technicianCrudRoutes");
const technicianStatsRoutes = require("./routes/technicianStatsRoutes");
const technicianAuthRoutes = require("./routes/technicianAuthRoutes");
const clientRoutes = require("./routes/clientRoutes");
const poolRoutes = require("./routes/poolRoutes");
const visitRoutes = require("./routes/visitRoutes");
const billingRoutes = require("./routes/billingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const clientPortalRoutes = require("./routes/clientPortalRoutes");
const reportRoutes = require("./routes/reportRoutes");
const reportVisitRoutes = require("./routes/reportVisitRoutes");
const reportSettingRoutes = require("./routes/reportSettingRoutes");
const technicianRoutes = require("./routes/technicianRoutes");
const accessRoutes = require("./routes/accessRoutes");
const keyRoutes = require("./routes/keyRoutes");
const alertRoutes = require("./routes/alertRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const invoicePdfRoutes = require("./routes/invoicePdfRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const emailRoutes = require("./routes/emailRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const routesRoutes = require("./routes/routesRoutes");
const routeRoutes = require("./routes/routeRoutes");
const workDayRoutes = require("./routes/technicianWorkDayRoutes");
const clientAuthRoutes = require("./routes/clientAuthRoutes");
const clientMessageRoutes = require("./routes/clientMessageRoutes");
const chatRoutes = require("./routes/chatRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const gpsRoutes = require("./routes/gpsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const notificationRuleRoutes = require("./routes/notificationRuleRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const searchRoutes = require("./routes/searchRoutes");
const zoneRoutes = require("./routes/zoneRoutes");
const extraRoutes = require("./routes/extraRoutes");
const extraVisitRoutes = require("./routes/extraVisitRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const equipmentStockOsRoutes = require("./routes/equipmentStockOsRoutes");
const financeOsRoutes = require("./routes/financeOsRoutes");
const brainApiRouter = require("./system/api/brainApiRouter");
const platformStatusRouter = require("./platform/api/platformStatusRouter");
const businessApiRouter = require("./business/api/businessApiRouter");
const realBusinessApiRouter = require("./business/api/realBusinessApiRouter");




const repairRoutes = require("./routes/repairRoutes");
const guideRoutes = require("./routes/guideRoutes");
const poolEquipmentRoutes = require("./routes/poolEquipmentRoutes");
const technicalHistoryRoutes = require("./routes/technicalHistoryRoutes");
const historyRoutes = require("./routes/historyRoutes");
const roundRoutes = require("./routes/roundRoutes");
const adminRoundsRoutes = require("./routes/adminRoundsRoutes");
const adminPaymentRoutes = require("./routes/adminPaymentRoutes");
const adminEmailLogRoutes = require("./routes/adminEmailLogRoutes");
const adminEmailRetryRoutes = require("./routes/adminEmailRetryRoutes");
const adminReportRoutes = require("./routes/adminReportRoutes");
const adminReportsRoutes = require("./routes/adminReportsRoutes");
const clientProfileRoutes = require("./routes/clientProfileRoutes");
const clientReportRoutes = require("./routes/clientReportRoutes");
const clientReportPDFRoutes = require("./routes/clientReportPDFRoutes");
const communicationRoutes = require("./routes/communicationRoutes");
const documentRoutes = require("./routes/documentRoutes");
const locationLogRoutes = require("./routes/locationLogRoutes");
const refreshTokenRoutes = require("./routes/refreshTokenRoutes");
const poolChatRoutes = require("./routes/poolChatRoutes");
const serviceChatRoutes = require("./routes/serviceChatRoutes");
const clientChatRoutes = require("./routes/clientChatRoutes");
const internalChatRoutes = require("./routes/internalChatRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const taskRoutes = require("./routes/taskRoutes");
const statsRoutes = require("./routes/statsRoutes");
const customerRoutes = require("./routes/customerRoutes");
const aiRoutes = require("./routes/aiRoutes");
const aiAdminRoutes = require("./routes/aiAdminRoutes");
const adminAiRoutes = require("./routes/adminAiRoutes");
const aiOpsRoutes = require("./routes/aiOpsRoutes");
const enterpriseCrmRoutes = require("./routes/enterpriseCrmRoutes");
const supplierHubRoutes = require("./routes/supplierHubRoutes");
const securityRoutes = require("./routes/securityRoutes");
const technicianIntakeRoutes = require("./routes/technicianIntakeRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const syncRoutes = require("./routes/syncRoutes");
const poolCalculationRoutes = require("./routes/poolCalculationRoutes");
const companyClosureRoutes = require("./routes/companyClosureRoutes");
const operationalFlowRoutes = require("./routes/operationalFlowRoutes");
const coreFlowRoutes = require("./routes/coreFlowRoutes");
const operationalStateRoutes = require("./routes/operationalStateRoutes");
const operationalRiskRoutes = require("./routes/operationalRiskRoutes");
const installationRoutes = require("./routes/installationRoutes");
const constructionRoutes = require("./routes/constructionRoutes");
const administrationRoutes = require("./routes/administrationRoutes");


// Background services
const { runAutoBilling } = require("./services/autoBillingService");
const { runAutoVisitAlerts } = require("./services/autoVisitAlertService");
const { detectOperationalIncidents, processSlaEscalations } = require("./services/incidentService");
const { runIncidentEngine } = require("./services/incidentEngine");
const { runRouteOptimization } = require("./services/routeOptimizationEngine");
const { runDispatchAi } = require("./services/dispatchAiService");

const app = express();
const server = http.createServer(app);

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyCorsOrigin = configuredCorsOrigins.includes("*");
const corsOptions = allowAnyCorsOrigin
  ? { origin: true }
  : { origin: configuredCorsOrigins, credentials: true };
const socketCorsOptions = allowAnyCorsOrigin
  ? { origin: "*" }
  : { origin: configuredCorsOrigins, credentials: true };

if (String(process.env.TRUST_PROXY || "").toLowerCase() === "true") {
  app.set("trust proxy", 1);
}

const io = new Server(server, { cors: socketCorsOptions });
global.io = io;

const PORT = Number(process.env.PORT || 4000);

assertJwtSecretForStartup();

const frontendPath = path.join(__dirname, "../frontend");
const uploadsPath = ensureUploadBaseDirReady();
const tempPath = path.join(__dirname, "../temp");
fs.mkdirSync(uploadsPath, { recursive: true });
fs.mkdirSync(tempPath, { recursive: true });

io.on("connection", (socket) => {
  logger.info("SOCKET_CONNECTED", { socketId: socket.id });

  socket.on("joinClient", (clientId) => socket.join("client_" + clientId));
  socket.on("userOnline", (data = {}) => {
    io.emit("presenceUpdate", {
      userId: data.userId,
      online: data.online === false ? false : true,
      lastSeen: new Date(),
      visibleToClients: data.visibleToClients === true,
    });
  });
  socket.on("sendMessage", (data = {}) => {
    if (data.clientId) io.to("client_" + data.clientId).emit("newMessage", data);
  });
  socket.on("typing", (data = {}) => {
    if (data.clientId) io.to("client_" + data.clientId).emit("typing", data);
  });
  socket.on("stopTyping", (data = {}) => {
    if (data.clientId) io.to("client_" + data.clientId).emit("stopTyping", data);
  });
  socket.on("disconnect", () => logger.info("SOCKET_DISCONNECTED", { socketId: socket.id }));
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(auditMiddleware);

app.use(express.static(frontendPath));
app.use(getUploadsPublicBasePath(), express.static(uploadsPath));

const frontendPages = fs
  .readdirSync(frontendPath)
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.replace(/\.html$/, ""));

frontendPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(frontendPath, `${page}.html`));
  });
  app.get(`/${page}.html`, (req, res) => {
    res.redirect(301, `/${page}`);
  });
});

function mount(pathname, router) {
  app.use(pathname, router);
}

// API core
mount("/api/system", systemRoutes);
mount("/api/auth", authRoutes);
mount("/api/admin-auth", require("./routes/adminAuthRoutes"));
mount("/api/users", userRoutes);
mount("/api/technicians", technicianCrudRoutes);
mount("/api/technician-stats", technicianStatsRoutes);
mount("/api/technician-auth", technicianAuthRoutes);
mount("/api/technician", technicianRoutes);
mount("/api/clients", clientRoutes);
mount("/api/pools", poolRoutes);
mount("/api/visits", visitRoutes);
mount("/api/billing", billingRoutes);
mount("/api/dashboard", dashboardRoutes);
mount("/api/client-portal", clientPortalRoutes);
mount("/api/client-profile", clientProfileRoutes);
mount("/api/reports", reportRoutes);
mount("/api/report-visit", reportVisitRoutes);
mount("/api/report-settings", reportSettingRoutes);
mount("/api/accesses", accessRoutes);
mount("/api/keys", keyRoutes);
mount("/api/alerts", alertRoutes);
mount("/api/invoices", invoiceRoutes);
mount("/api/invoice-pdf", invoicePdfRoutes);
mount("/api/payments", paymentRoutes);
mount("/api/whatsapp", whatsappRoutes);
mount("/api/email", emailRoutes);
mount("/api/reminders", reminderRoutes);
mount("/api/routes", routesRoutes);
mount("/api/route", routeRoutes);
mount("/api/workday", workDayRoutes);
mount("/api/client-auth", clientAuthRoutes);
mount("/api/client-messages", clientMessageRoutes);
mount("/api/chat", chatRoutes);
mount("/api/metrics", metricsRoutes);
mount("/api/gps", gpsRoutes);
mount("/api/notifications", notificationRoutes);
mount("/api/notification-rules", notificationRuleRoutes);
mount("/api/settings", settingsRoutes);
mount("/api/search", searchRoutes);
mount("/api/zones", zoneRoutes);
mount("/api/extras", extraRoutes);
mount("/api/extra-visits", extraVisitRoutes);
mount("/api/incidents", incidentRoutes);
mount("/api/equipment-stock-os", equipmentStockOsRoutes);
mount("/api/finance-os", financeOsRoutes);

// Modules previously present but not wired in server.js
mount("/api/repairs", repairRoutes);
mount("/api/guides", guideRoutes);
mount("/api/pool-equipment", poolEquipmentRoutes);
mount("/api/poolEquipment", poolEquipmentRoutes);
mount("/api/technical-history", technicalHistoryRoutes);
mount("/api/technicalHistory", technicalHistoryRoutes);
mount("/api/history", historyRoutes);
mount("/api/rounds", adminRoundsRoutes);
mount("/api/admin/rounds", adminRoundsRoutes);
mount("/api/round-planner", roundRoutes);
mount("/api/admin/payments", adminPaymentRoutes);
mount("/api/admin", adminEmailLogRoutes);
mount("/api/admin", adminEmailRetryRoutes);
mount("/api/admin", adminReportRoutes);
mount("/api/admin", adminReportsRoutes);
mount("/api/client", clientReportPDFRoutes);
mount("/api/client-reports", clientReportRoutes);
mount("/api/communications", communicationRoutes);
mount("/api/documents", documentRoutes);
mount("/api/location-logs", locationLogRoutes);
mount("/api/refresh-token", refreshTokenRoutes);
mount("/api/poolChat", poolChatRoutes);
mount("/api/pool-chat", poolChatRoutes);
mount("/api/serviceChat", serviceChatRoutes);
mount("/api/service-chat", serviceChatRoutes);
mount("/api/clientChat", clientChatRoutes);
mount("/api/client-chat", clientChatRoutes);
mount("/api/internal-chat", internalChatRoutes);
mount("/api/services", serviceRoutes);
mount("/api/tasks", taskRoutes);
mount("/api/stats", statsRoutes);
mount("/api/customers", customerRoutes);
mount("/api/ai", aiRoutes);
mount("/api/ai-admin", aiAdminRoutes);
mount("/api/admin-ai", adminAiRoutes);
mount("/api/ai-ops", aiOpsRoutes);
mount("/api/admin/ai", aiOpsRoutes);
mount("/api/crm", enterpriseCrmRoutes);
mount("/api/agenda", enterpriseCrmRoutes);
mount("/api/suppliers", supplierHubRoutes);
mount("/api/quick-links", supplierHubRoutes);
mount("/api/security", securityRoutes);
mount("/api/technician-intake", technicianIntakeRoutes);
mount("/api/inventory", inventoryRoutes);
mount("/api/stock", inventoryRoutes);
mount("/api/sync", syncRoutes);
mount("/api/pool-calculations", poolCalculationRoutes);
mount("/api/calculator", poolCalculationRoutes);
mount("/api/company-closures", companyClosureRoutes);
mount("/api/closures", companyClosureRoutes);
mount("/api/operational-flow", operationalFlowRoutes);
mount("/api/core", coreFlowRoutes);
mount("/api/operational-state", operationalStateRoutes);
mount("/api/operational-risk", operationalRiskRoutes);
mount("/api/installations", installationRoutes);
mount("/api/construction", constructionRoutes);
mount("/api/administration", administrationRoutes);


app.get("/", (req, res) => {
  res.redirect("/admin-master-control");
});

function safeRun(name, fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => logger.error(`BACKGROUND_JOB_${name}_ERROR`, { message: err.message }));
}

function scheduleBackgroundJobs() {
  const enabled = String(process.env.ENABLE_BACKGROUND_JOBS || "false").toLowerCase() === "true";
  if (!enabled) {
    logger.info("BACKGROUND_JOBS_DISABLED", { hint: "Set ENABLE_BACKGROUND_JOBS=true to enable crons/AI engines" });
    return;
  }

  safeRun("AUTO_BILLING", runAutoBilling);
  setInterval(() => safeRun("AUTO_BILLING", runAutoBilling), 1000 * 60 * 60 * 24);

  safeRun("AUTO_VISIT_ALERTS", runAutoVisitAlerts);
  setInterval(() => safeRun("AUTO_VISIT_ALERTS", runAutoVisitAlerts), 1000 * 60 * 60);

  safeRun("INCIDENT_DETECTION", detectOperationalIncidents);
  setInterval(() => safeRun("INCIDENT_DETECTION", detectOperationalIncidents), 1000 * 60 * 5);

  safeRun("INCIDENT_ENGINE", runIncidentEngine);
  setInterval(() => safeRun("INCIDENT_ENGINE", runIncidentEngine), 1000 * 60 * 10);

  safeRun("SLA_ESCALATIONS", processSlaEscalations);
  setInterval(() => safeRun("SLA_ESCALATIONS", processSlaEscalations), 1000 * 60);

  safeRun("ROUTE_OPTIMIZATION", runRouteOptimization);
  setInterval(() => safeRun("ROUTE_OPTIMIZATION", runRouteOptimization), 1000 * 60 * 15);

  safeRun("DISPATCH_AI", runDispatchAi);
  setInterval(() => safeRun("DISPATCH_AI", runDispatchAi), 1000 * 60 * 15);
}

scheduleBackgroundJobs();

// V21 Frontend continuity fallback: invalid frontend paths return dashboard/login without destroying session.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
  const target = req.path.toLowerCase().includes("login") ? "login.html" : "admin-dashboard.html";
  res.sendFile(path.join(frontendPath, target));
});

app.use("/api/brain", brainApiRouter);
app.use("/api/platform", platformStatusRouter);
app.use("/api/business", businessApiRouter);
app.use("/api/real-business", realBusinessApiRouter);




app.use(errorHandlerMiddleware);

server.listen(PORT, () => {
  logger.info("SERVER_STARTED", { port: PORT });
  console.log(`🚀 Cristal Water Enterprise ativo em http://localhost:${PORT}`);
});

# PRE FUNCTIONAL TEST BASELINE - 2026-07-19

Relatório read-only de baseline antes de teste funcional completo.

## Resumo Executivo

- Branch atual: feature/technicians-v25
- Ficheiros modificados: 220
- Ficheiros não rastreados: 313
- Total de entradas alteradas (status): 533
- Porta 3002: listener ativo e único identificado.
- Health check: ONLINE com database ONLINE.
- Migrations: schema up to date (sem pendências).
## 1) Branch Atual


```
feature/technicians-v25
```

## 2) git status --short


```
 M .gitignore
 M CHANGELOG.md
 M README_VPS_DEPLOY.md
 M RELEASES.md
 M ROADMAP.md
 M frontend/admin-ai.html
 M frontend/admin-alerts.html
 M frontend/admin-auth-guard.js
 M frontend/admin-client-settings.html
 M frontend/admin-clients.html
 M frontend/admin-collection.html
 M frontend/admin-collection.js
 M frontend/admin-command-center.html
 M frontend/admin-company-closures.html
 M frontend/admin-core-flow.html
 M frontend/admin-crm.html
 M frontend/admin-dashboard.html
 M frontend/admin-email-logs.html
 M frontend/admin-email-logs.js
 M frontend/admin-inventory.html
 M frontend/admin-inventory.js
 M frontend/admin-keys.html
 M frontend/admin-keys.js
 M frontend/admin-live-map.html
 M frontend/admin-login.html
 M frontend/admin-map.html
 M frontend/admin-map.js
 M frontend/admin-master-control.html
 M frontend/admin-master-control.js
 M frontend/admin-menu.html
 M frontend/admin-notifications.html
 M frontend/admin-notifications.js
 M frontend/admin-onboarding.html
 M frontend/admin-operational-flow.html
 M frontend/admin-operational-settings.html
 M frontend/admin-operational-settings.js
 M frontend/admin-payment-settings.html
 M frontend/admin-payments.html
 M frontend/admin-payments.js
 M frontend/admin-pool-calculator.html
 M frontend/admin-pool-technical.html
 M frontend/admin-pools.html
 M frontend/admin-priority.html
 M frontend/admin-reports.html
 M frontend/admin-reports.js
 M frontend/admin-rounds.html
 M frontend/admin-security.html
 M frontend/admin-security.js
 M frontend/admin-service-log.html
 M frontend/admin-service-log.js
 M frontend/admin-suppliers.html
 M frontend/admin-technicians.html
 M frontend/admin-test-center.html
 M frontend/admin-today.html
 M frontend/admin-today.js
 M frontend/admin-ui-settings.html
 M frontend/admin-vehicles.html
 M frontend/admin-vehicles.js
 M frontend/admin-visits-dashboard.html
 M frontend/admin-visits.html
 M frontend/alerts-financial.html
 M frontend/alerts.html
 M frontend/billing-center.html
 M frontend/billing-center.js
 M frontend/billing-extras.html
 M frontend/billing-history.html
 M frontend/billing.html
 M frontend/billing.js
 M frontend/chat.html
 M frontend/chat.js
 M frontend/client-auth-guard.js
 M frontend/client-dashboard.html
 M frontend/client-dashboard.js
 M frontend/client-history.html
 M frontend/client-history.js
 M frontend/client-login.html
 M frontend/client-login.js
 M frontend/client-menu.html
 M frontend/client-notifications.html
 M frontend/client-notifications.js
 M frontend/client-payments.html
 M frontend/client-payments.js
 M frontend/client-portal.html
 M frontend/client-portal.js
 M frontend/client-wow.html
 M frontend/client-wow.js
 M frontend/client.html
 M frontend/client.js
 M frontend/client_chat.html
 M frontend/client_chat.js
 M frontend/client_tech.html
 M frontend/communications.html
 M frontend/communications.js
 M frontend/config-notifications.html
 M frontend/cristal-assist.js
 M frontend/cw-enterprise-sidebar.js
 M frontend/cw-flow-shell.js
 M frontend/cw-polish.css
 M frontend/dashboard.html
 M frontend/dashboard.js
 M frontend/gps.js
 M frontend/help-center.html
 M frontend/incident-center.html
 M frontend/invoices.html
 M frontend/invoices.js
 M frontend/js/offline/offline-gps.js
 M frontend/js/offline/offline-queue.js
 M frontend/login.html
 M frontend/map.html
 M frontend/metrics.html
 M frontend/multi-map.html
 M frontend/notifications.html
 M frontend/notifications.js
 M frontend/operational-dashboard.html
 M frontend/operational-dashboard.js
 M frontend/profit-map.html
 M frontend/ranking.html
 M frontend/report-center.html
 M frontend/report-settings.html
 M frontend/report-settings.js
 M frontend/route-map.html
 M frontend/route-map.js
 M frontend/settings.html
 M frontend/splash.html
 M frontend/technician-field-mode.html
 M frontend/technician-field-mode.js
 M frontend/technician-gps.html
 M frontend/technician-guide.html
 M frontend/technician-guide.js
 M frontend/technician-login.html
 M frontend/technician-map.html
 M frontend/technician-map.js
 M frontend/technician-new-client.html
 M frontend/technician-route.html
 M frontend/technician-route.js
 M frontend/technician-visit.html
 M frontend/technician-visit.js
 M frontend/technician.html
 M frontend/technician.js
 M frontend/to-issue.html
 M frontend/to-issue.js
 M package-lock.json
 M package.json
 M prisma/seed.js
 M scripts/test-core-flow.js
 M scripts/test-final-two-year-real-simulation.js
 M scripts/test-system-interconnections.js
 M src/business/technician/TechnicianGpsBusiness.js
 M src/business/technician/TechnicianRouteBusiness.js
 M src/business/technician/TechnicianVisitBusiness.js
 M src/business/technician/TechnicianWorkdayBusiness.js
 M src/controllers/adminRoundsController.js
 M src/controllers/aiOpsController.js
 M src/controllers/authController.js
 M src/controllers/clientAuthController.js
 M src/controllers/clientPortalController.js
 M src/controllers/emailController.js
 M src/controllers/guideController.js
 M src/controllers/inventoryController.js
 M src/controllers/invoiceController.js
 M src/controllers/paymentController.js
 M src/controllers/poolCalculationController.js
 M src/controllers/poolChatController.js
 M src/controllers/poolController.js
 M src/controllers/poolEquipmentController.js
 M src/controllers/reminderController.js
 M src/controllers/reportVisitController.js
 M src/controllers/routeController.js
 M src/controllers/securityController.js
 M src/controllers/technicalHistoryController.js
 M src/controllers/technicianAuthController.js
 M src/controllers/technicianController.js
 M src/controllers/technicianPortalController.js
 M src/controllers/technicianStatsController.js
 M src/controllers/visitController.js
 M src/core/crystal/events/EventEngine.js
 M src/core/crystal/permissions/PermissionGuardian.js
 M src/loadEnv.js
 M src/middlewares/aiAdminAuth.js
 M src/middlewares/authJwt.js
 M src/middlewares/authMiddleware.js
 M src/routes/accessRoutes.js
 M src/routes/adminAuthRoutes.js
 M src/routes/adminPaymentRoutes.js
 M src/routes/adminReportsRoutes.js
 M src/routes/adminRoundsRoutes.js
 M src/routes/clientAuthRoutes.js
 M src/routes/clientMessageRoutes.js
 M src/routes/clientPortalRoutes.js
 M src/routes/clientRoutes.js
 M src/routes/coreFlowRoutes.js
 M src/routes/dashboardRoutes.js
 M src/routes/documentRoutes.js
 M src/routes/gpsRoutes.js
 M src/routes/guideRoutes.js
 M src/routes/inventoryRoutes.js
 M src/routes/invoiceRoutes.js
 M src/routes/operationalFlowRoutes.js
 M src/routes/poolEquipmentRoutes.js
 M src/routes/refreshTokenRoutes.js
 M src/routes/repairRoutes.js
 M src/routes/reportRoutes.js
 M src/routes/reportVisitRoutes.js
 M src/routes/searchRoutes.js
 M src/routes/serviceRoutes.js
 M src/routes/settingsRoutes.js
 M src/routes/technicianRoutes.js
 M src/routes/technicianWorkDayRoutes.js
 M src/routes/visitRoutes.js
 M src/routes/whatsappRoutes.js
 M src/server.js
 M src/services/adminAuthService.js
 M src/services/aiAdminActionService.js
 M src/services/aiOpsService.js
 M src/services/emailService.js
 M src/services/paymentReminderService.js
 M src/services/paymentService.js
 M src/services/serviceVisitCompletionService.js
 M src/services/whatsappService.js
 M src/socket/socketServer.js
?? ", v.status, v.active, v.createdAt"
?? ", v.status, v.active, v.createdAt.save"
?? ": QA, mode: insensitive } },"
?? AGENT_RULES.md
?? ARCHITECTURE_DECISIONS.md
?? "AS ("
?? BUSINESS_RULES.md
?? CEO_DIRECTIVES.md
?? COMPANY_BRAIN.md
?? CRYSTAL_ADMIN_EXPERIENCE.md
?? CRYSTAL_COMPONENT_LIBRARY.md
?? CRYSTAL_CONSTITUTION.md
?? CRYSTAL_CUSTOMER_EXPERIENCE.md
?? CRYSTAL_DESIGN_SYSTEM.md
?? CRYSTAL_ENV_ALIGNMENT_REPORT.md
?? CRYSTAL_EVOLUTION_MASTERPLAN.md
?? CRYSTAL_FRONTEND_AUDIT.md
?? CRYSTAL_IMPLEMENTATION_SEQUENCE.md
?? CRYSTAL_NAVIGATION_SYSTEM.md
?? CRYSTAL_OS.md
?? CRYSTAL_OS_2035.md
?? CRYSTAL_OS_INFORMATION_ARCHITECTURE.md
?? CRYSTAL_OS_MASTER_VISION.md
?? CRYSTAL_OS_STRATEGIC_ALIGNMENT.md
?? CRYSTAL_OS_V2_PHASE_1_REPORT.md
?? CRYSTAL_OS_V2_PHASE_2_REPORT.md
?? CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md
?? CRYSTAL_OS_V2_STABILIZATION_REPORT.md
?? CRYSTAL_OS_ZERO_BUGS_REPORT.md
?? CRYSTAL_PRICIPLES.md
?? CRYSTAL_REBUILD_MASTERPLAN.md
?? CRYSTAL_SECRETARY_EXPERIENCE.md
?? CRYSTAL_TECHNICIAN_EXPERIENCE.md
?? CRYSTAL_UX_ARCHITECT_AUDIT.md
?? CRYSTAL_UX_MASTERPLAN.md
?? CRYSTAL_UX_PROBLEMS.md
?? CRYSTAL_VISUAL_ANALYSIS.md
?? CTO_DIRECTIVES.md
?? DEFINITION_OF_DONE.md
?? ENGINEERING_STANDARD.md
?? ENV_SWITCH_REPORT.md
?? EPICS.md
?? FIELD_FEEDBACK.md
?? IDEAS_BACKLOG.md
?? OPERATIONS.md
?? POOL_OS_REPORT.md
?? PRODUCTION_AUDIT.md
?? PRODUCTION_BOOTSTRAP_PLAN.md
?? PRODUCTION_CLEAN_PLAN.md
?? PRODUCTION_CLEAN_SAFETY_REPORT.md
?? PRODUCTION_READY_REPORT.md
?? PROJECT_MANIFEST.md
?? PROJECT_VISION.md
?? RC1_SAFE_IMPLEMENTATION_PLAN.md
?? STRATEGIC_BACKLOG_REPORT.md
?? STRESS_001_BLOCKERS_FIX_REPORT.md
?? STRESS_001_ROOT_CAUSE_REPORT.md
?? STRESS_001_SHAKEDOWN_REPORT.md
?? SUPABASE_FINAL_CLEAN_REPORT.md
?? SUPABASE_FORENSIC_REPORT.md
?? SUPABASE_MASTER_AUDIT.md
?? SUPABASE_PRODUCTION_FIX_EXECUTION_REPORT.md
?? SUPABASE_PRODUCTION_FIX_PLAN.md
?? SUPABASE_PRODUCTION_READINESS_REPORT.md
?? TECHNICIAN_OS_REPORT.md
?? UX_COMPONENT_SYSTEM_REPORT.md
?? UX_FINAL_IMPLEMENT_REPORT.md
?? UX_REBUILD_MASTER_REPORT.md
?? UX_REBUILD_PHASE_REPORT.md
?? UX_VISUAL_PROTOTYPE_REPORT.md
?? UX_VISUAL_REBUILD_REPORT.md
?? VISION.md
?? ZERO_BUGS_BACKEND_SECURITY_FIX_REPORT.md
?? ZERO_BUGS_CLIENT_AUTH_DIAGNOSTIC.md
?? ZERO_BUGS_FAILURE_DIAGNOSTIC.md
?? ZERO_BUGS_REMAINING_FAILURES.md
?? "c' },"
?? docs/FINAL_SECURITY_VALIDATION.md
?? docs/FINAL_TEST_MATRIX.md
?? docs/FINAL_UI_UX_AND_TEST_REPORT.md
?? docs/FINAL_VISUAL_VALIDATION.md
?? docs/QA_ENVIRONMENT_PROPOSAL.md
?? docs/QA_FUNCTIONAL_EXECUTION_PLAN.md
?? docs/RC1_SECURITY_MATRIX.md
?? docs/UI_UX_AUDIT.md
?? docs/UI_UX_PAGE_PROGRESS.md
?? docs/UI_UX_REFACTOR_PLAN.md
?? docs/product/CRYSTAL_WATER_AI_RULEBOOK.md
?? docs/product/CRYSTAL_WATER_COMPONENT_LIBRARY.md
?? docs/product/CRYSTAL_WATER_DESIGN_SPECIFICATION.md
?? docs/product/CRYSTAL_WATER_EXPERIENCE_BIBLE.md
?? docs/product/CRYSTAL_WATER_RELEASE_CHECKLIST.md
?? docs/product/CRYSTAL_WATER_USER_FLOWS.md
?? docs/product/CRYSTAL_WATER_VISUAL_REFERENCE.md
?? docs/product/PHASE2_1_FOUNDATION_REPORT.md
?? docs/product/PHASE2_LOTE_B_REPORT_20260713.md
?? docs/product/PHASE2_LOTE_C_REPORT_20260714.md
?? docs/product/PHASE2_LOTE_D_REPORT_20260714.md
?? docs/product/PHASE2_LOTE_E_REPORT_20260714.md
?? docs/product/PHASE2_LOTE_F_REPORT_20260714.md
?? docs/product/PHASE2_LOTE_G_REPORT_20260714.md
?? docs/product/PHASE2_LOT_20260713_REPORT.md
?? docs/product/PHASE2_VISUAL_DECISION_LOG.md
?? docs/product/evidence/
?? docs/product/screenshots/phase2-lote-b/
?? docs/product/screenshots/phase2-lote-c/
?? docs/product/screenshots/phase2-lote-d/
?? docs/product/screenshots/phase2-lote-e/
?? docs/product/screenshots/phase2-lote-f/
?? docs/product/screenshots/phase2-lote-g/
?? docs/product/screenshots/phase2-lote-h/admin-ai-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-ai-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-ai-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-ai-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-company-closures-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-company-closures-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-company-closures-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-company-closures-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-crm-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-crm-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-crm-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-crm-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-onboarding-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-onboarding-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-onboarding-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-onboarding-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-operational-settings-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-operational-settings-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-operational-settings-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-operational-settings-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-payment-settings-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-payment-settings-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-payment-settings-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-payment-settings-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-security-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-security-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-security-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-security-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-technicians-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-technicians-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-technicians-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-technicians-390-light.png
?? docs/product/screenshots/phase2-lote-h/admin-ui-settings-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-ui-settings-1440-light.png
?? docs/product/screenshots/phase2-lote-h/admin-ui-settings-390-dark.png
?? docs/product/screenshots/phase2-lote-h/admin-ui-settings-390-light.png
?? docs/product/screenshots/phase2-lote-h/alerts-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/alerts-1440-light.png
?? docs/product/screenshots/phase2-lote-h/alerts-390-dark.png
?? docs/product/screenshots/phase2-lote-h/alerts-390-light.png
?? docs/product/screenshots/phase2-lote-h/billing-history-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/billing-history-1440-light.png
?? docs/product/screenshots/phase2-lote-h/billing-history-390-dark.png
?? docs/product/screenshots/phase2-lote-h/billing-history-390-light.png
?? docs/product/screenshots/phase2-lote-h/client-wow-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/client-wow-1440-light.png
?? docs/product/screenshots/phase2-lote-h/client-wow-390-dark.png
?? docs/product/screenshots/phase2-lote-h/client-wow-390-light.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-1440-light.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-390-dark.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-390-light.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-1440-light.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-390-dark.png
?? docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-390-light.png
?? docs/product/screenshots/phase2-lote-h/to-issue-1440-dark.png
?? docs/product/screenshots/phase2-lote-h/to-issue-1440-light.png
?? docs/product/screenshots/phase2-lote-h/to-issue-390-dark.png
?? docs/product/screenshots/phase2-lote-h/to-issue-390-light.png
?? et
?? "et=\"utf-8\">"
?? frontend-backup-20260711-172931/
?? frontend/crystal-os-v2-foundation.css
?? frontend/crystal-os-v2-nav.js
?? frontend/crystal-os-v2-phase2-adapter.css
?? frontend/crystal-os-v2-route-index.html
?? frontend/crystal-os-v2-shell.js
?? frontend/cw-admin-premium-controls.js
?? frontend/cw-block2-shell.css
?? frontend/cw-block2-shell.js
?? frontend/cw-component-system.css
?? frontend/cw-component-system.js
?? frontend/cw-final-implement-001.css
?? frontend/cw-os-admin-shell.js
?? frontend/cw-os-admin.css
?? frontend/cw-premium-admin-phase1.css
?? frontend/cw-ui-kit.css
?? frontend/cw-visual-prototype-002.css
?? frontend/cw-visual-rebuild-001.css
?? frontend/technician-auth-guard.js
?? frontend/technician-chat.html
?? frontend/technician-chat.js
?? frontend/technician-gps.js
?? frontend/technician-history.html
?? frontend/technician-history.js
?? frontend/technician-login.js
?? frontend/technician-profile.html
?? frontend/technician-profile.js
?? frontend/ui/components/animations.css
?? frontend/ui/components/bottom-nav.css
?? frontend/ui/components/button.css
?? frontend/ui/components/card.css
?? frontend/ui/components/dashboard.css
?? frontend/ui/components/empty-state.css
?? frontend/ui/components/error-state.css
?? frontend/ui/components/input.css
?? frontend/ui/components/kpi.css
?? frontend/ui/components/loading.css
?? frontend/ui/components/map.css
?? frontend/ui/components/modal.css
?? frontend/ui/components/offline-state.css
?? frontend/ui/components/search.css
?? frontend/ui/components/sidebar.css
?? frontend/ui/components/table.css
?? frontend/ui/components/timeline.css
?? frontend/ui/components/toast.css
?? frontend/ui/components/topbar.css
?? frontend/ui/core/navigation-context.js
?? frontend/ui/foundation.css
?? frontend/ui/layout.css
?? frontend/ui/theme-dark.css
?? frontend/ui/theme-light.css
?? frontend/ui/tokens.css
?? frontend/ui/typography.css
?? "it\" v WHERE v.\"clientId\" IN (SELECT id FROM test_clients)"
?? it','Invoice')
?? ole.error(e);
?? "ole.error(e); process.exit(1); }).finally(async ()=>{ await prisma.$disconnect(); });"
?? ole.log('FK_DEPENDENCIES');
?? prepare-production.js
?? "s AS referencing_table,"
?? "s::text IN ('\"Vehicle\"','\"Notification\"','\"Client\"')"
?? scripts/assert-qa-environment.js
?? scripts/capture-phase2-lote-c.js
?? scripts/capture-phase2-lote-d.js
?? scripts/capture-phase2-lote-e.js
?? scripts/capture-phase2-lote-f.js
?? scripts/capture-phase2-lote-g.js
?? scripts/capture-phase2-lote-h.js
?? scripts/rebuild-phase2-global-audit-v2.js
?? scripts/rebuild-phase2-global-audit.js
?? scripts/test-administration-os-operational.js
?? scripts/test-construction-os-operational.js
?? scripts/test-crystal-os-zero-bugs.js
?? scripts/test-customer-os-operational.js
?? scripts/test-equipment-stock-os-operational.js
?? scripts/test-finance-os-acceptance.js
?? scripts/test-finance-os-operational.js
?? scripts/test-installation-os-full-operational.js
?? scripts/test-installation-os-operational.js
?? scripts/test-repair-os-operational.js
?? scripts/test-route-os-acceptance.js
?? scripts/test-secure-auth-matrix.js
?? scripts/test-security-report-sanitization.js
?? scripts/test-visit-os-operational.js
?? scripts/test-zero-bugs-backend-security.js
?? src/business/admin/
?? src/business/construction/
?? src/business/finance/
?? src/business/installation/
?? src/business/operations/
?? src/business/pool/PoolCalculationBusiness.js
?? src/business/pool/PoolChatBusiness.js
?? src/business/pool/PoolChemistryBusiness.js
?? src/business/pool/PoolDashboardBusiness.js
?? src/business/pool/PoolEquipmentBusiness.js
?? src/business/pool/PoolHistoryBusiness.js
?? src/business/pool/PoolMaintenanceBusiness.js
?? src/business/pool/PoolVisitBusiness.js
?? src/business/repair/
?? src/business/technician/TechnicianAuthBusiness.js
?? src/business/technician/TechnicianPortalBusiness.js
?? src/business/technician/TechnicianStatsBusiness.js
?? src/config/externalIntegrations.js
?? src/config/uploadPath.js
?? src/controllers/administrationController.js
?? src/controllers/constructionController.js
?? src/controllers/equipmentStockOsController.js
?? src/controllers/financeOsController.js
?? src/controllers/installationController.js
?? src/controllers/repairController.js
?? src/dal/AdministrationRepository.js
?? src/dal/ConstructionRepository.js
?? src/dal/EquipmentStockRepository.js
?? src/dal/FinanceOsRepository.js
?? src/dal/InstallationRepository.js
?? src/dal/RepairRepository.js
?? src/routes/administrationRoutes.js
?? src/routes/constructionRoutes.js
?? src/routes/equipmentStockOsRoutes.js
?? src/routes/financeOsRoutes.js
?? src/routes/installationRoutes.js
?? src/routes/technicianStatsRoutes.js
?? src/services/administrationEventService.js
?? src/services/aiProvider.js
?? src/services/constructionEventService.js
?? src/services/customerPortalService.js
?? src/services/equipmentStockEventService.js
?? src/services/financeOsEventService.js
?? src/services/installationEventService.js
?? src/services/repairEventService.js
?? src/services/routeOsEventService.js
?? src/utils/jwtPrincipalGuard.js
?? src/utils/jwtSecret.js
?? "t counts = await prisma.$queryRawUnsafe(`"
?? "t prisma = new PrismaClient();"
?? "t r of counts) {"
?? "t_clients t ON t.id=c.id"
?? tests/
?? "traints tc"
?? vitest.config.js
?? "ync () => {"
```

## 3) git diff --stat


```
 .gitignore                                         |    5 +
 CHANGELOG.md                                       |   28 +
 README_VPS_DEPLOY.md                               |   47 +
 RELEASES.md                                        |   16 +
 ROADMAP.md                                         |  319 ++++-
 frontend/admin-ai.html                             |   16 +-
 frontend/admin-alerts.html                         |   17 +-
 frontend/admin-auth-guard.js                       |   57 +-
 frontend/admin-client-settings.html                |   94 +-
 frontend/admin-clients.html                        |   22 +-
 frontend/admin-collection.html                     |   10 +-
 frontend/admin-collection.js                       |  276 ++--
 frontend/admin-command-center.html                 |  379 +-----
 frontend/admin-company-closures.html               |   15 +-
 frontend/admin-core-flow.html                      |    6 +-
 frontend/admin-crm.html                            |   16 +-
 frontend/admin-dashboard.html                      |   89 +-
 frontend/admin-email-logs.html                     |   10 +-
 frontend/admin-email-logs.js                       |   56 +-
 frontend/admin-inventory.html                      |  120 +-
 frontend/admin-inventory.js                        |  235 +++-
 frontend/admin-keys.html                           |    6 +-
 frontend/admin-keys.js                             |    4 +-
 frontend/admin-live-map.html                       |   59 +-
 frontend/admin-login.html                          |    6 +-
 frontend/admin-map.html                            |   18 +-
 frontend/admin-map.js                              |  286 ++--
 frontend/admin-master-control.html                 |  794 ++++++++---
 frontend/admin-master-control.js                   |   78 +-
 frontend/admin-menu.html                           |  256 +++-
 frontend/admin-notifications.html                  |   10 +-
 frontend/admin-notifications.js                    |   26 +-
 frontend/admin-onboarding.html                     |   16 +-
 frontend/admin-operational-flow.html               |    7 +-
 frontend/admin-operational-settings.html           |   16 +-
 frontend/admin-operational-settings.js             |  191 +--
 frontend/admin-payment-settings.html               |   29 +-
 frontend/admin-payments.html                       |   71 +-
 frontend/admin-payments.js                         |  169 ++-
 frontend/admin-pool-calculator.html                |   15 +-
 frontend/admin-pool-technical.html                 |   12 +-
 frontend/admin-pools.html                          |   21 +-
 frontend/admin-priority.html                       |   83 +-
 frontend/admin-reports.html                        |   79 +-
 frontend/admin-reports.js                          |   73 +-
 frontend/admin-rounds.html                         |   14 +-
 frontend/admin-security.html                       |   14 +-
 frontend/admin-security.js                         |    6 +-
 frontend/admin-service-log.html                    |   11 +-
 frontend/admin-service-log.js                      |   10 +-
 frontend/admin-suppliers.html                      |   11 +-
 frontend/admin-technicians.html                    |   16 +-
 frontend/admin-test-center.html                    |    6 +-
 frontend/admin-today.html                          |  164 ++-
 frontend/admin-today.js                            |  302 ++++-
 frontend/admin-ui-settings.html                    |   22 +-
 frontend/admin-vehicles.html                       |   12 +-
 frontend/admin-vehicles.js                         |   14 +-
 frontend/admin-visits-dashboard.html               |   85 +-
 frontend/admin-visits.html                         |  110 +-
 frontend/alerts-financial.html                     |  194 ++-
 frontend/alerts.html                               |  266 +++-
 frontend/billing-center.html                       |   59 +-
 frontend/billing-center.js                         |  113 +-
 frontend/billing-extras.html                       |   61 +-
 frontend/billing-history.html                      |   40 +-
 frontend/billing.html                              |   10 +-
 frontend/billing.js                                |   77 +-
 frontend/chat.html                                 |    9 +-
 frontend/chat.js                                   |   12 +-
 frontend/client-auth-guard.js                      |    6 +
 frontend/client-dashboard.html                     |   17 +-
 frontend/client-dashboard.js                       |   78 +-
 frontend/client-history.html                       |   21 +-
 frontend/client-history.js                         |   34 +-
 frontend/client-login.html                         |    6 +-
 frontend/client-login.js                           |   34 +-
 frontend/client-menu.html                          |   21 +-
 frontend/client-notifications.html                 |   19 +-
 frontend/client-notifications.js                   |   22 +-
 frontend/client-payments.html                      |   19 +-
 frontend/client-payments.js                        |   10 +-
 frontend/client-portal.html                        |  644 +++++++--
 frontend/client-portal.js                          |  123 +-
 frontend/client-wow.html                           |   18 +-
 frontend/client-wow.js                             |    2 -
 frontend/client.html                               |   30 +-
 frontend/client.js                                 |   15 +-
 frontend/client_chat.html                          |   20 +-
 frontend/client_chat.js                            |  128 +-
 frontend/client_tech.html                          |   19 +-
 frontend/communications.html                       |   10 +-
 frontend/communications.js                         |   14 +-
 frontend/config-notifications.html                 |   10 +-
 frontend/cristal-assist.js                         |    5 +-
 frontend/cw-enterprise-sidebar.js                  |    4 +-
 frontend/cw-flow-shell.js                          |   61 +-
 frontend/cw-polish.css                             |   44 +
 frontend/dashboard.html                            |   16 +-
 frontend/dashboard.js                              |  131 +-
 frontend/gps.js                                    |   12 +-
 frontend/help-center.html                          |   10 +-
 frontend/incident-center.html                      |  712 ++--------
 frontend/invoices.html                             |   36 +-
 frontend/invoices.js                               |  201 +--
 frontend/js/offline/offline-gps.js                 |    9 +-
 frontend/js/offline/offline-queue.js               |   72 +-
 frontend/login.html                                |  530 +++-----
 frontend/map.html                                  |   91 +-
 frontend/metrics.html                              |   28 +-
 frontend/multi-map.html                            |  138 +-
 frontend/notifications.html                        |   10 +-
 frontend/notifications.js                          |  549 ++++----
 frontend/operational-dashboard.html                |   15 +-
 frontend/operational-dashboard.js                  |  204 +--
 frontend/profit-map.html                           |  142 +-
 frontend/ranking.html                              |   66 +-
 frontend/report-center.html                        |   39 +-
 frontend/report-settings.html                      |   10 +-
 frontend/report-settings.js                        |   16 +-
 frontend/route-map.html                            |   19 +-
 frontend/route-map.js                              |  112 +-
 frontend/settings.html                             |   69 +-
 frontend/splash.html                               |   37 +-
 frontend/technician-field-mode.html                | 1294 +++++++++---------
 frontend/technician-field-mode.js                  |   36 +-
 frontend/technician-gps.html                       |  170 ++-
 frontend/technician-guide.html                     |  172 ++-
 frontend/technician-guide.js                       |  153 ++-
 frontend/technician-login.html                     |    8 +-
 frontend/technician-map.html                       |  250 +++-
 frontend/technician-map.js                         |  253 +++-
 frontend/technician-new-client.html                |   17 +-
 frontend/technician-route.html                     |  206 ++-
 frontend/technician-route.js                       |  161 ++-
 frontend/technician-visit.html                     |  689 +++++++++-
 frontend/technician-visit.js                       |  335 ++++-
 frontend/technician.html                           |   61 +-
 frontend/technician.js                             |  335 +++--
 frontend/to-issue.html                             |   17 +-
 frontend/to-issue.js                               |   21 +-
 package-lock.json                                  | 1402 ++++++++++++++++++--
 package.json                                       |   14 +-
 prisma/seed.js                                     |  185 ++-
 scripts/test-core-flow.js                          |   17 +-
 scripts/test-final-two-year-real-simulation.js     |   81 +-
 scripts/test-system-interconnections.js            |   77 +-
 src/business/technician/TechnicianGpsBusiness.js   |  544 ++++++++
 src/business/technician/TechnicianRouteBusiness.js |  115 +-
 src/business/technician/TechnicianVisitBusiness.js |  570 ++++++++
 .../technician/TechnicianWorkdayBusiness.js        |   74 ++
 src/controllers/adminRoundsController.js           |   12 +
 src/controllers/aiOpsController.js                 |    5 +-
 src/controllers/authController.js                  |    3 +-
 src/controllers/clientAuthController.js            |    3 +-
 src/controllers/clientPortalController.js          |   60 +
 src/controllers/emailController.js                 |    7 +
 src/controllers/guideController.js                 |    3 +-
 src/controllers/inventoryController.js             |    3 +-
 src/controllers/invoiceController.js               |    2 +-
 src/controllers/paymentController.js               |    2 +-
 src/controllers/poolCalculationController.js       |  159 +--
 src/controllers/poolChatController.js              |   31 +-
 src/controllers/poolController.js                  |    7 +-
 src/controllers/poolEquipmentController.js         |  143 +-
 src/controllers/reminderController.js              |    6 +
 src/controllers/reportVisitController.js           |   21 +-
 src/controllers/routeController.js                 |   15 +
 src/controllers/securityController.js              |   47 +-
 src/controllers/technicalHistoryController.js      |   87 +-
 src/controllers/technicianAuthController.js        |   71 +-
 src/controllers/technicianController.js            |  149 +--
 src/controllers/technicianPortalController.js      |  287 +---
 src/controllers/technicianStatsController.js       |  102 +-
 src/controllers/visitController.js                 |  285 +---
 src/core/crystal/events/EventEngine.js             |    5 +
 src/core/crystal/permissions/PermissionGuardian.js |    9 +
 src/loadEnv.js                                     |   84 +-
 src/middlewares/aiAdminAuth.js                     |    3 +-
 src/middlewares/authJwt.js                         |   22 +-
 src/middlewares/authMiddleware.js                  |   29 +-
 src/routes/accessRoutes.js                         |    3 +-
 src/routes/adminAuthRoutes.js                      |    3 +-
 src/routes/adminPaymentRoutes.js                   |    3 +
 src/routes/adminReportsRoutes.js                   |    3 +
 src/routes/adminRoundsRoutes.js                    |   38 +-
 src/routes/clientAuthRoutes.js                     |   49 +-
 src/routes/clientMessageRoutes.js                  |    7 +-
 src/routes/clientPortalRoutes.js                   |  262 +++-
 src/routes/clientRoutes.js                         |    4 +
 src/routes/coreFlowRoutes.js                       |  106 +-
 src/routes/dashboardRoutes.js                      |    6 +-
 src/routes/documentRoutes.js                       |    5 +-
 src/routes/gpsRoutes.js                            |  565 +-------
 src/routes/guideRoutes.js                          |    6 +-
 src/routes/inventoryRoutes.js                      |    8 +-
 src/routes/invoiceRoutes.js                        |   10 +
 src/routes/operationalFlowRoutes.js                |   40 +-
 src/routes/poolEquipmentRoutes.js                  |   10 +
 src/routes/refreshTokenRoutes.js                   |    3 +-
 src/routes/repairRoutes.js                         |  456 +------
 src/routes/reportRoutes.js                         |   21 +
 src/routes/reportVisitRoutes.js                    |    3 +
 src/routes/searchRoutes.js                         |    3 +
 src/routes/serviceRoutes.js                        |    3 +
 src/routes/settingsRoutes.js                       |    3 +-
 src/routes/technicianRoutes.js                     |   46 +-
 src/routes/technicianWorkDayRoutes.js              |  106 +-
 src/routes/visitRoutes.js                          |  397 +++---
 src/routes/whatsappRoutes.js                       |   82 +-
 src/server.js                                      |   21 +-
 src/services/adminAuthService.js                   |    3 +-
 src/services/aiAdminActionService.js               |   16 +-
 src/services/aiOpsService.js                       |   17 +-
 src/services/emailService.js                       |  221 +--
 src/services/paymentReminderService.js             |    4 +-
 src/services/paymentService.js                     |    2 +-
 src/services/serviceVisitCompletionService.js      |  179 ++-
 src/services/whatsappService.js                    |  283 ++--
 src/socket/socketServer.js                         |    2 +
 220 files changed, 14827 insertions(+), 7595 deletions(-)
```

## 4) Ficheiros Modificados

- .gitignore
- CHANGELOG.md
- README_VPS_DEPLOY.md
- RELEASES.md
- ROADMAP.md
- frontend/admin-ai.html
- frontend/admin-alerts.html
- frontend/admin-auth-guard.js
- frontend/admin-client-settings.html
- frontend/admin-clients.html
- frontend/admin-collection.html
- frontend/admin-collection.js
- frontend/admin-command-center.html
- frontend/admin-company-closures.html
- frontend/admin-core-flow.html
- frontend/admin-crm.html
- frontend/admin-dashboard.html
- frontend/admin-email-logs.html
- frontend/admin-email-logs.js
- frontend/admin-inventory.html
- frontend/admin-inventory.js
- frontend/admin-keys.html
- frontend/admin-keys.js
- frontend/admin-live-map.html
- frontend/admin-login.html
- frontend/admin-map.html
- frontend/admin-map.js
- frontend/admin-master-control.html
- frontend/admin-master-control.js
- frontend/admin-menu.html
- frontend/admin-notifications.html
- frontend/admin-notifications.js
- frontend/admin-onboarding.html
- frontend/admin-operational-flow.html
- frontend/admin-operational-settings.html
- frontend/admin-operational-settings.js
- frontend/admin-payment-settings.html
- frontend/admin-payments.html
- frontend/admin-payments.js
- frontend/admin-pool-calculator.html
- frontend/admin-pool-technical.html
- frontend/admin-pools.html
- frontend/admin-priority.html
- frontend/admin-reports.html
- frontend/admin-reports.js
- frontend/admin-rounds.html
- frontend/admin-security.html
- frontend/admin-security.js
- frontend/admin-service-log.html
- frontend/admin-service-log.js
- frontend/admin-suppliers.html
- frontend/admin-technicians.html
- frontend/admin-test-center.html
- frontend/admin-today.html
- frontend/admin-today.js
- frontend/admin-ui-settings.html
- frontend/admin-vehicles.html
- frontend/admin-vehicles.js
- frontend/admin-visits-dashboard.html
- frontend/admin-visits.html
- frontend/alerts-financial.html
- frontend/alerts.html
- frontend/billing-center.html
- frontend/billing-center.js
- frontend/billing-extras.html
- frontend/billing-history.html
- frontend/billing.html
- frontend/billing.js
- frontend/chat.html
- frontend/chat.js
- frontend/client-auth-guard.js
- frontend/client-dashboard.html
- frontend/client-dashboard.js
- frontend/client-history.html
- frontend/client-history.js
- frontend/client-login.html
- frontend/client-login.js
- frontend/client-menu.html
- frontend/client-notifications.html
- frontend/client-notifications.js
- frontend/client-payments.html
- frontend/client-payments.js
- frontend/client-portal.html
- frontend/client-portal.js
- frontend/client-wow.html
- frontend/client-wow.js
- frontend/client.html
- frontend/client.js
- frontend/client_chat.html
- frontend/client_chat.js
- frontend/client_tech.html
- frontend/communications.html
- frontend/communications.js
- frontend/config-notifications.html
- frontend/cristal-assist.js
- frontend/cw-enterprise-sidebar.js
- frontend/cw-flow-shell.js
- frontend/cw-polish.css
- frontend/dashboard.html
- frontend/dashboard.js
- frontend/gps.js
- frontend/help-center.html
- frontend/incident-center.html
- frontend/invoices.html
- frontend/invoices.js
- frontend/js/offline/offline-gps.js
- frontend/js/offline/offline-queue.js
- frontend/login.html
- frontend/map.html
- frontend/metrics.html
- frontend/multi-map.html
- frontend/notifications.html
- frontend/notifications.js
- frontend/operational-dashboard.html
- frontend/operational-dashboard.js
- frontend/profit-map.html
- frontend/ranking.html
- frontend/report-center.html
- frontend/report-settings.html
- frontend/report-settings.js
- frontend/route-map.html
- frontend/route-map.js
- frontend/settings.html
- frontend/splash.html
- frontend/technician-field-mode.html
- frontend/technician-field-mode.js
- frontend/technician-gps.html
- frontend/technician-guide.html
- frontend/technician-guide.js
- frontend/technician-login.html
- frontend/technician-map.html
- frontend/technician-map.js
- frontend/technician-new-client.html
- frontend/technician-route.html
- frontend/technician-route.js
- frontend/technician-visit.html
- frontend/technician-visit.js
- frontend/technician.html
- frontend/technician.js
- frontend/to-issue.html
- frontend/to-issue.js
- package-lock.json
- package.json
- prisma/seed.js
- scripts/test-core-flow.js
- scripts/test-final-two-year-real-simulation.js
- scripts/test-system-interconnections.js
- src/business/technician/TechnicianGpsBusiness.js
- src/business/technician/TechnicianRouteBusiness.js
- src/business/technician/TechnicianVisitBusiness.js
- src/business/technician/TechnicianWorkdayBusiness.js
- src/controllers/adminRoundsController.js
- src/controllers/aiOpsController.js
- src/controllers/authController.js
- src/controllers/clientAuthController.js
- src/controllers/clientPortalController.js
- src/controllers/emailController.js
- src/controllers/guideController.js
- src/controllers/inventoryController.js
- src/controllers/invoiceController.js
- src/controllers/paymentController.js
- src/controllers/poolCalculationController.js
- src/controllers/poolChatController.js
- src/controllers/poolController.js
- src/controllers/poolEquipmentController.js
- src/controllers/reminderController.js
- src/controllers/reportVisitController.js
- src/controllers/routeController.js
- src/controllers/securityController.js
- src/controllers/technicalHistoryController.js
- src/controllers/technicianAuthController.js
- src/controllers/technicianController.js
- src/controllers/technicianPortalController.js
- src/controllers/technicianStatsController.js
- src/controllers/visitController.js
- src/core/crystal/events/EventEngine.js
- src/core/crystal/permissions/PermissionGuardian.js
- src/loadEnv.js
- src/middlewares/aiAdminAuth.js
- src/middlewares/authJwt.js
- src/middlewares/authMiddleware.js
- src/routes/accessRoutes.js
- src/routes/adminAuthRoutes.js
- src/routes/adminPaymentRoutes.js
- src/routes/adminReportsRoutes.js
- src/routes/adminRoundsRoutes.js
- src/routes/clientAuthRoutes.js
- src/routes/clientMessageRoutes.js
- src/routes/clientPortalRoutes.js
- src/routes/clientRoutes.js
- src/routes/coreFlowRoutes.js
- src/routes/dashboardRoutes.js
- src/routes/documentRoutes.js
- src/routes/gpsRoutes.js
- src/routes/guideRoutes.js
- src/routes/inventoryRoutes.js
- src/routes/invoiceRoutes.js
- src/routes/operationalFlowRoutes.js
- src/routes/poolEquipmentRoutes.js
- src/routes/refreshTokenRoutes.js
- src/routes/repairRoutes.js
- src/routes/reportRoutes.js
- src/routes/reportVisitRoutes.js
- src/routes/searchRoutes.js
- src/routes/serviceRoutes.js
- src/routes/settingsRoutes.js
- src/routes/technicianRoutes.js
- src/routes/technicianWorkDayRoutes.js
- src/routes/visitRoutes.js
- src/routes/whatsappRoutes.js
- src/server.js
- src/services/adminAuthService.js
- src/services/aiAdminActionService.js
- src/services/aiOpsService.js
- src/services/emailService.js
- src/services/paymentReminderService.js
- src/services/paymentService.js
- src/services/serviceVisitCompletionService.js
- src/services/whatsappService.js
- src/socket/socketServer.js
## 5) Ficheiros Não Rastreado(s)

- , v.status, v.active, v.createdAt
- , v.status, v.active, v.createdAt.save
- : QA, mode: insensitive } },
- AGENT_RULES.md
- ARCHITECTURE_DECISIONS.md
- AS (
- BUSINESS_RULES.md
- CEO_DIRECTIVES.md
- COMPANY_BRAIN.md
- CRYSTAL_ADMIN_EXPERIENCE.md
- CRYSTAL_COMPONENT_LIBRARY.md
- CRYSTAL_CONSTITUTION.md
- CRYSTAL_CUSTOMER_EXPERIENCE.md
- CRYSTAL_DESIGN_SYSTEM.md
- CRYSTAL_ENV_ALIGNMENT_REPORT.md
- CRYSTAL_EVOLUTION_MASTERPLAN.md
- CRYSTAL_FRONTEND_AUDIT.md
- CRYSTAL_IMPLEMENTATION_SEQUENCE.md
- CRYSTAL_NAVIGATION_SYSTEM.md
- CRYSTAL_OS.md
- CRYSTAL_OS_2035.md
- CRYSTAL_OS_INFORMATION_ARCHITECTURE.md
- CRYSTAL_OS_MASTER_VISION.md
- CRYSTAL_OS_STRATEGIC_ALIGNMENT.md
- CRYSTAL_OS_V2_PHASE_1_REPORT.md
- CRYSTAL_OS_V2_PHASE_2_REPORT.md
- CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md
- CRYSTAL_OS_V2_STABILIZATION_REPORT.md
- CRYSTAL_OS_ZERO_BUGS_REPORT.md
- CRYSTAL_PRICIPLES.md
- CRYSTAL_REBUILD_MASTERPLAN.md
- CRYSTAL_SECRETARY_EXPERIENCE.md
- CRYSTAL_TECHNICIAN_EXPERIENCE.md
- CRYSTAL_UX_ARCHITECT_AUDIT.md
- CRYSTAL_UX_MASTERPLAN.md
- CRYSTAL_UX_PROBLEMS.md
- CRYSTAL_VISUAL_ANALYSIS.md
- CTO_DIRECTIVES.md
- DEFINITION_OF_DONE.md
- ENGINEERING_STANDARD.md
- ENV_SWITCH_REPORT.md
- EPICS.md
- FIELD_FEEDBACK.md
- IDEAS_BACKLOG.md
- OPERATIONS.md
- POOL_OS_REPORT.md
- PRODUCTION_AUDIT.md
- PRODUCTION_BOOTSTRAP_PLAN.md
- PRODUCTION_CLEAN_PLAN.md
- PRODUCTION_CLEAN_SAFETY_REPORT.md
- PRODUCTION_READY_REPORT.md
- PROJECT_MANIFEST.md
- PROJECT_VISION.md
- RC1_SAFE_IMPLEMENTATION_PLAN.md
- STRATEGIC_BACKLOG_REPORT.md
- STRESS_001_BLOCKERS_FIX_REPORT.md
- STRESS_001_ROOT_CAUSE_REPORT.md
- STRESS_001_SHAKEDOWN_REPORT.md
- SUPABASE_FINAL_CLEAN_REPORT.md
- SUPABASE_FORENSIC_REPORT.md
- SUPABASE_MASTER_AUDIT.md
- SUPABASE_PRODUCTION_FIX_EXECUTION_REPORT.md
- SUPABASE_PRODUCTION_FIX_PLAN.md
- SUPABASE_PRODUCTION_READINESS_REPORT.md
- TECHNICIAN_OS_REPORT.md
- UX_COMPONENT_SYSTEM_REPORT.md
- UX_FINAL_IMPLEMENT_REPORT.md
- UX_REBUILD_MASTER_REPORT.md
- UX_REBUILD_PHASE_REPORT.md
- UX_VISUAL_PROTOTYPE_REPORT.md
- UX_VISUAL_REBUILD_REPORT.md
- VISION.md
- ZERO_BUGS_BACKEND_SECURITY_FIX_REPORT.md
- ZERO_BUGS_CLIENT_AUTH_DIAGNOSTIC.md
- ZERO_BUGS_FAILURE_DIAGNOSTIC.md
- ZERO_BUGS_REMAINING_FAILURES.md
- c' },
- docs/FINAL_SECURITY_VALIDATION.md
- docs/FINAL_TEST_MATRIX.md
- docs/FINAL_UI_UX_AND_TEST_REPORT.md
- docs/FINAL_VISUAL_VALIDATION.md
- docs/QA_ENVIRONMENT_PROPOSAL.md
- docs/QA_FUNCTIONAL_EXECUTION_PLAN.md
- docs/RC1_SECURITY_MATRIX.md
- docs/UI_UX_AUDIT.md
- docs/UI_UX_PAGE_PROGRESS.md
- docs/UI_UX_REFACTOR_PLAN.md
- docs/product/CRYSTAL_WATER_AI_RULEBOOK.md
- docs/product/CRYSTAL_WATER_COMPONENT_LIBRARY.md
- docs/product/CRYSTAL_WATER_DESIGN_SPECIFICATION.md
- docs/product/CRYSTAL_WATER_EXPERIENCE_BIBLE.md
- docs/product/CRYSTAL_WATER_RELEASE_CHECKLIST.md
- docs/product/CRYSTAL_WATER_USER_FLOWS.md
- docs/product/CRYSTAL_WATER_VISUAL_REFERENCE.md
- docs/product/PHASE2_1_FOUNDATION_REPORT.md
- docs/product/PHASE2_LOTE_B_REPORT_20260713.md
- docs/product/PHASE2_LOTE_C_REPORT_20260714.md
- docs/product/PHASE2_LOTE_D_REPORT_20260714.md
- docs/product/PHASE2_LOTE_E_REPORT_20260714.md
- docs/product/PHASE2_LOTE_F_REPORT_20260714.md
- docs/product/PHASE2_LOTE_G_REPORT_20260714.md
- docs/product/PHASE2_LOT_20260713_REPORT.md
- docs/product/PHASE2_VISUAL_DECISION_LOG.md
- docs/product/evidence/
- docs/product/screenshots/phase2-lote-b/
- docs/product/screenshots/phase2-lote-c/
- docs/product/screenshots/phase2-lote-d/
- docs/product/screenshots/phase2-lote-e/
- docs/product/screenshots/phase2-lote-f/
- docs/product/screenshots/phase2-lote-g/
- docs/product/screenshots/phase2-lote-h/admin-ai-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ai-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-ai-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ai-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-crm-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-crm-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-crm-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-crm-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-security-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-security-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-security-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-security-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-390-light.png
- docs/product/screenshots/phase2-lote-h/alerts-1440-dark.png
- docs/product/screenshots/phase2-lote-h/alerts-1440-light.png
- docs/product/screenshots/phase2-lote-h/alerts-390-dark.png
- docs/product/screenshots/phase2-lote-h/alerts-390-light.png
- docs/product/screenshots/phase2-lote-h/billing-history-1440-dark.png
- docs/product/screenshots/phase2-lote-h/billing-history-1440-light.png
- docs/product/screenshots/phase2-lote-h/billing-history-390-dark.png
- docs/product/screenshots/phase2-lote-h/billing-history-390-light.png
- docs/product/screenshots/phase2-lote-h/client-wow-1440-dark.png
- docs/product/screenshots/phase2-lote-h/client-wow-1440-light.png
- docs/product/screenshots/phase2-lote-h/client-wow-390-dark.png
- docs/product/screenshots/phase2-lote-h/client-wow-390-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-1440-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-1440-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-390-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-390-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-1440-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-1440-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-390-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-390-light.png
- docs/product/screenshots/phase2-lote-h/to-issue-1440-dark.png
- docs/product/screenshots/phase2-lote-h/to-issue-1440-light.png
- docs/product/screenshots/phase2-lote-h/to-issue-390-dark.png
- docs/product/screenshots/phase2-lote-h/to-issue-390-light.png
- et
- et="utf-8">
- frontend-backup-20260711-172931/
- frontend/crystal-os-v2-foundation.css
- frontend/crystal-os-v2-nav.js
- frontend/crystal-os-v2-phase2-adapter.css
- frontend/crystal-os-v2-route-index.html
- frontend/crystal-os-v2-shell.js
- frontend/cw-admin-premium-controls.js
- frontend/cw-block2-shell.css
- frontend/cw-block2-shell.js
- frontend/cw-component-system.css
- frontend/cw-component-system.js
- frontend/cw-final-implement-001.css
- frontend/cw-os-admin-shell.js
- frontend/cw-os-admin.css
- frontend/cw-premium-admin-phase1.css
- frontend/cw-ui-kit.css
- frontend/cw-visual-prototype-002.css
- frontend/cw-visual-rebuild-001.css
- frontend/technician-auth-guard.js
- frontend/technician-chat.html
- frontend/technician-chat.js
- frontend/technician-gps.js
- frontend/technician-history.html
- frontend/technician-history.js
- frontend/technician-login.js
- frontend/technician-profile.html
- frontend/technician-profile.js
- frontend/ui/components/animations.css
- frontend/ui/components/bottom-nav.css
- frontend/ui/components/button.css
- frontend/ui/components/card.css
- frontend/ui/components/dashboard.css
- frontend/ui/components/empty-state.css
- frontend/ui/components/error-state.css
- frontend/ui/components/input.css
- frontend/ui/components/kpi.css
- frontend/ui/components/loading.css
- frontend/ui/components/map.css
- frontend/ui/components/modal.css
- frontend/ui/components/offline-state.css
- frontend/ui/components/search.css
- frontend/ui/components/sidebar.css
- frontend/ui/components/table.css
- frontend/ui/components/timeline.css
- frontend/ui/components/toast.css
- frontend/ui/components/topbar.css
- frontend/ui/core/navigation-context.js
- frontend/ui/foundation.css
- frontend/ui/layout.css
- frontend/ui/theme-dark.css
- frontend/ui/theme-light.css
- frontend/ui/tokens.css
- frontend/ui/typography.css
- it" v WHERE v."clientId" IN (SELECT id FROM test_clients)
- it','Invoice')
- ole.error(e);
- ole.error(e); process.exit(1); }).finally(async ()=>{ await prisma.$disconnect(); });
- ole.log('FK_DEPENDENCIES');
- prepare-production.js
- s AS referencing_table,
- s::text IN ('"Vehicle"','"Notification"','"Client"')
- scripts/assert-qa-environment.js
- scripts/capture-phase2-lote-c.js
- scripts/capture-phase2-lote-d.js
- scripts/capture-phase2-lote-e.js
- scripts/capture-phase2-lote-f.js
- scripts/capture-phase2-lote-g.js
- scripts/capture-phase2-lote-h.js
- scripts/rebuild-phase2-global-audit-v2.js
- scripts/rebuild-phase2-global-audit.js
- scripts/test-administration-os-operational.js
- scripts/test-construction-os-operational.js
- scripts/test-crystal-os-zero-bugs.js
- scripts/test-customer-os-operational.js
- scripts/test-equipment-stock-os-operational.js
- scripts/test-finance-os-acceptance.js
- scripts/test-finance-os-operational.js
- scripts/test-installation-os-full-operational.js
- scripts/test-installation-os-operational.js
- scripts/test-repair-os-operational.js
- scripts/test-route-os-acceptance.js
- scripts/test-secure-auth-matrix.js
- scripts/test-security-report-sanitization.js
- scripts/test-visit-os-operational.js
- scripts/test-zero-bugs-backend-security.js
- src/business/admin/
- src/business/construction/
- src/business/finance/
- src/business/installation/
- src/business/operations/
- src/business/pool/PoolCalculationBusiness.js
- src/business/pool/PoolChatBusiness.js
- src/business/pool/PoolChemistryBusiness.js
- src/business/pool/PoolDashboardBusiness.js
- src/business/pool/PoolEquipmentBusiness.js
- src/business/pool/PoolHistoryBusiness.js
- src/business/pool/PoolMaintenanceBusiness.js
- src/business/pool/PoolVisitBusiness.js
- src/business/repair/
- src/business/technician/TechnicianAuthBusiness.js
- src/business/technician/TechnicianPortalBusiness.js
- src/business/technician/TechnicianStatsBusiness.js
- src/config/externalIntegrations.js
- src/config/uploadPath.js
- src/controllers/administrationController.js
- src/controllers/constructionController.js
- src/controllers/equipmentStockOsController.js
- src/controllers/financeOsController.js
- src/controllers/installationController.js
- src/controllers/repairController.js
- src/dal/AdministrationRepository.js
- src/dal/ConstructionRepository.js
- src/dal/EquipmentStockRepository.js
- src/dal/FinanceOsRepository.js
- src/dal/InstallationRepository.js
- src/dal/RepairRepository.js
- src/routes/administrationRoutes.js
- src/routes/constructionRoutes.js
- src/routes/equipmentStockOsRoutes.js
- src/routes/financeOsRoutes.js
- src/routes/installationRoutes.js
- src/routes/technicianStatsRoutes.js
- src/services/administrationEventService.js
- src/services/aiProvider.js
- src/services/constructionEventService.js
- src/services/customerPortalService.js
- src/services/equipmentStockEventService.js
- src/services/financeOsEventService.js
- src/services/installationEventService.js
- src/services/repairEventService.js
- src/services/routeOsEventService.js
- src/utils/jwtPrincipalGuard.js
- src/utils/jwtSecret.js
- t counts = await prisma.$queryRawUnsafe(`
- t prisma = new PrismaClient();
- t r of counts) {
- t_clients t ON t.id=c.id
- tests/
- traints tc
- vitest.config.js
- ync () => {
## 6) Agrupamento de Alterações

- frontend: 188
- backend: 121
- testes: 20
- scripts: 9
- documentacao: 169
- uploads/temp/logs: 0
- possivelmente gerado: 3
- outros: 23

### frontend
- frontend/admin-ai.html
- frontend/admin-alerts.html
- frontend/admin-auth-guard.js
- frontend/admin-client-settings.html
- frontend/admin-clients.html
- frontend/admin-collection.html
- frontend/admin-collection.js
- frontend/admin-command-center.html
- frontend/admin-company-closures.html
- frontend/admin-core-flow.html
- frontend/admin-crm.html
- frontend/admin-dashboard.html
- frontend/admin-email-logs.html
- frontend/admin-email-logs.js
- frontend/admin-inventory.html
- frontend/admin-inventory.js
- frontend/admin-keys.html
- frontend/admin-keys.js
- frontend/admin-live-map.html
- frontend/admin-login.html
- frontend/admin-map.html
- frontend/admin-map.js
- frontend/admin-master-control.html
- frontend/admin-master-control.js
- frontend/admin-menu.html
- frontend/admin-notifications.html
- frontend/admin-notifications.js
- frontend/admin-onboarding.html
- frontend/admin-operational-flow.html
- frontend/admin-operational-settings.html
- frontend/admin-operational-settings.js
- frontend/admin-payment-settings.html
- frontend/admin-payments.html
- frontend/admin-payments.js
- frontend/admin-pool-calculator.html
- frontend/admin-pool-technical.html
- frontend/admin-pools.html
- frontend/admin-priority.html
- frontend/admin-reports.html
- frontend/admin-reports.js
- frontend/admin-rounds.html
- frontend/admin-security.html
- frontend/admin-security.js
- frontend/admin-service-log.html
- frontend/admin-service-log.js
- frontend/admin-suppliers.html
- frontend/admin-technicians.html
- frontend/admin-test-center.html
- frontend/admin-today.html
- frontend/admin-today.js
- frontend/admin-ui-settings.html
- frontend/admin-vehicles.html
- frontend/admin-vehicles.js
- frontend/admin-visits-dashboard.html
- frontend/admin-visits.html
- frontend/alerts-financial.html
- frontend/alerts.html
- frontend/billing-center.html
- frontend/billing-center.js
- frontend/billing-extras.html
- frontend/billing-history.html
- frontend/billing.html
- frontend/billing.js
- frontend/chat.html
- frontend/chat.js
- frontend/client-auth-guard.js
- frontend/client-dashboard.html
- frontend/client-dashboard.js
- frontend/client-history.html
- frontend/client-history.js
- frontend/client-login.html
- frontend/client-login.js
- frontend/client-menu.html
- frontend/client-notifications.html
- frontend/client-notifications.js
- frontend/client-payments.html
- frontend/client-payments.js
- frontend/client-portal.html
- frontend/client-portal.js
- frontend/client-wow.html
- frontend/client-wow.js
- frontend/client.html
- frontend/client.js
- frontend/client_chat.html
- frontend/client_chat.js
- frontend/client_tech.html
- frontend/communications.html
- frontend/communications.js
- frontend/config-notifications.html
- frontend/cristal-assist.js
- frontend/crystal-os-v2-foundation.css
- frontend/crystal-os-v2-nav.js
- frontend/crystal-os-v2-phase2-adapter.css
- frontend/crystal-os-v2-route-index.html
- frontend/crystal-os-v2-shell.js
- frontend/cw-admin-premium-controls.js
- frontend/cw-block2-shell.css
- frontend/cw-block2-shell.js
- frontend/cw-component-system.css
- frontend/cw-component-system.js
- frontend/cw-enterprise-sidebar.js
- frontend/cw-final-implement-001.css
- frontend/cw-flow-shell.js
- frontend/cw-os-admin-shell.js
- frontend/cw-os-admin.css
- frontend/cw-polish.css
- frontend/cw-premium-admin-phase1.css
- frontend/cw-ui-kit.css
- frontend/cw-visual-prototype-002.css
- frontend/cw-visual-rebuild-001.css
- frontend/dashboard.html
- frontend/dashboard.js
- frontend/gps.js
- frontend/help-center.html
- frontend/incident-center.html
- frontend/invoices.html
- frontend/invoices.js
- frontend/js/offline/offline-gps.js
- frontend/js/offline/offline-queue.js
- frontend/login.html
- frontend/map.html
- frontend/metrics.html
- frontend/multi-map.html
- frontend/notifications.html
- frontend/notifications.js
- frontend/operational-dashboard.html
- frontend/operational-dashboard.js
- frontend/profit-map.html
- frontend/ranking.html
- frontend/report-center.html
- frontend/report-settings.html
- frontend/report-settings.js
- frontend/route-map.html
- frontend/route-map.js
- frontend/settings.html
- frontend/splash.html
- frontend/technician-auth-guard.js
- frontend/technician-chat.html
- frontend/technician-chat.js
- frontend/technician-field-mode.html
- frontend/technician-field-mode.js
- frontend/technician-gps.html
- frontend/technician-gps.js
- frontend/technician-guide.html
- frontend/technician-guide.js
- frontend/technician-history.html
- frontend/technician-history.js
- frontend/technician-login.html
- frontend/technician-login.js
- frontend/technician-map.html
- frontend/technician-map.js
- frontend/technician-new-client.html
- frontend/technician-profile.html
- frontend/technician-profile.js
- frontend/technician-route.html
- frontend/technician-route.js
- frontend/technician-visit.html
- frontend/technician-visit.js
- frontend/technician.html
- frontend/technician.js
- frontend/to-issue.html
- frontend/to-issue.js
- frontend/ui/components/animations.css
- frontend/ui/components/bottom-nav.css
- frontend/ui/components/button.css
- frontend/ui/components/card.css
- frontend/ui/components/dashboard.css
- frontend/ui/components/empty-state.css
- frontend/ui/components/error-state.css
- frontend/ui/components/input.css
- frontend/ui/components/kpi.css
- frontend/ui/components/loading.css
- frontend/ui/components/map.css
- frontend/ui/components/modal.css
- frontend/ui/components/offline-state.css
- frontend/ui/components/search.css
- frontend/ui/components/sidebar.css
- frontend/ui/components/table.css
- frontend/ui/components/timeline.css
- frontend/ui/components/toast.css
- frontend/ui/components/topbar.css
- frontend/ui/core/navigation-context.js
- frontend/ui/foundation.css
- frontend/ui/layout.css
- frontend/ui/theme-dark.css
- frontend/ui/theme-light.css
- frontend/ui/tokens.css
- frontend/ui/typography.css

### backend
- src/business/admin/
- src/business/construction/
- src/business/finance/
- src/business/installation/
- src/business/operations/
- src/business/pool/PoolCalculationBusiness.js
- src/business/pool/PoolChatBusiness.js
- src/business/pool/PoolChemistryBusiness.js
- src/business/pool/PoolDashboardBusiness.js
- src/business/pool/PoolEquipmentBusiness.js
- src/business/pool/PoolHistoryBusiness.js
- src/business/pool/PoolMaintenanceBusiness.js
- src/business/pool/PoolVisitBusiness.js
- src/business/repair/
- src/business/technician/TechnicianAuthBusiness.js
- src/business/technician/TechnicianGpsBusiness.js
- src/business/technician/TechnicianPortalBusiness.js
- src/business/technician/TechnicianRouteBusiness.js
- src/business/technician/TechnicianStatsBusiness.js
- src/business/technician/TechnicianVisitBusiness.js
- src/business/technician/TechnicianWorkdayBusiness.js
- src/config/externalIntegrations.js
- src/config/uploadPath.js
- src/controllers/adminRoundsController.js
- src/controllers/administrationController.js
- src/controllers/aiOpsController.js
- src/controllers/authController.js
- src/controllers/clientAuthController.js
- src/controllers/clientPortalController.js
- src/controllers/constructionController.js
- src/controllers/emailController.js
- src/controllers/equipmentStockOsController.js
- src/controllers/financeOsController.js
- src/controllers/guideController.js
- src/controllers/installationController.js
- src/controllers/inventoryController.js
- src/controllers/invoiceController.js
- src/controllers/paymentController.js
- src/controllers/poolCalculationController.js
- src/controllers/poolChatController.js
- src/controllers/poolController.js
- src/controllers/poolEquipmentController.js
- src/controllers/reminderController.js
- src/controllers/repairController.js
- src/controllers/reportVisitController.js
- src/controllers/routeController.js
- src/controllers/securityController.js
- src/controllers/technicalHistoryController.js
- src/controllers/technicianAuthController.js
- src/controllers/technicianController.js
- src/controllers/technicianPortalController.js
- src/controllers/technicianStatsController.js
- src/controllers/visitController.js
- src/core/crystal/events/EventEngine.js
- src/core/crystal/permissions/PermissionGuardian.js
- src/dal/AdministrationRepository.js
- src/dal/ConstructionRepository.js
- src/dal/EquipmentStockRepository.js
- src/dal/FinanceOsRepository.js
- src/dal/InstallationRepository.js
- src/dal/RepairRepository.js
- src/loadEnv.js
- src/middlewares/aiAdminAuth.js
- src/middlewares/authJwt.js
- src/middlewares/authMiddleware.js
- src/routes/accessRoutes.js
- src/routes/adminAuthRoutes.js
- src/routes/adminPaymentRoutes.js
- src/routes/adminReportsRoutes.js
- src/routes/adminRoundsRoutes.js
- src/routes/administrationRoutes.js
- src/routes/clientAuthRoutes.js
- src/routes/clientMessageRoutes.js
- src/routes/clientPortalRoutes.js
- src/routes/clientRoutes.js
- src/routes/constructionRoutes.js
- src/routes/coreFlowRoutes.js
- src/routes/dashboardRoutes.js
- src/routes/documentRoutes.js
- src/routes/equipmentStockOsRoutes.js
- src/routes/financeOsRoutes.js
- src/routes/gpsRoutes.js
- src/routes/guideRoutes.js
- src/routes/installationRoutes.js
- src/routes/inventoryRoutes.js
- src/routes/invoiceRoutes.js
- src/routes/operationalFlowRoutes.js
- src/routes/poolEquipmentRoutes.js
- src/routes/refreshTokenRoutes.js
- src/routes/repairRoutes.js
- src/routes/reportRoutes.js
- src/routes/reportVisitRoutes.js
- src/routes/searchRoutes.js
- src/routes/serviceRoutes.js
- src/routes/settingsRoutes.js
- src/routes/technicianRoutes.js
- src/routes/technicianStatsRoutes.js
- src/routes/technicianWorkDayRoutes.js
- src/routes/visitRoutes.js
- src/routes/whatsappRoutes.js
- src/server.js
- src/services/adminAuthService.js
- src/services/administrationEventService.js
- src/services/aiAdminActionService.js
- src/services/aiOpsService.js
- src/services/aiProvider.js
- src/services/constructionEventService.js
- src/services/customerPortalService.js
- src/services/emailService.js
- src/services/equipmentStockEventService.js
- src/services/financeOsEventService.js
- src/services/installationEventService.js
- src/services/paymentReminderService.js
- src/services/paymentService.js
- src/services/repairEventService.js
- src/services/routeOsEventService.js
- src/services/serviceVisitCompletionService.js
- src/services/whatsappService.js
- src/socket/socketServer.js
- src/utils/jwtPrincipalGuard.js
- src/utils/jwtSecret.js

### testes
- scripts/test-administration-os-operational.js
- scripts/test-construction-os-operational.js
- scripts/test-core-flow.js
- scripts/test-crystal-os-zero-bugs.js
- scripts/test-customer-os-operational.js
- scripts/test-equipment-stock-os-operational.js
- scripts/test-final-two-year-real-simulation.js
- scripts/test-finance-os-acceptance.js
- scripts/test-finance-os-operational.js
- scripts/test-installation-os-full-operational.js
- scripts/test-installation-os-operational.js
- scripts/test-repair-os-operational.js
- scripts/test-route-os-acceptance.js
- scripts/test-secure-auth-matrix.js
- scripts/test-security-report-sanitization.js
- scripts/test-system-interconnections.js
- scripts/test-visit-os-operational.js
- scripts/test-zero-bugs-backend-security.js
- tests/
- vitest.config.js

### scripts
- scripts/assert-qa-environment.js
- scripts/capture-phase2-lote-c.js
- scripts/capture-phase2-lote-d.js
- scripts/capture-phase2-lote-e.js
- scripts/capture-phase2-lote-f.js
- scripts/capture-phase2-lote-g.js
- scripts/capture-phase2-lote-h.js
- scripts/rebuild-phase2-global-audit-v2.js
- scripts/rebuild-phase2-global-audit.js

### documentação
- AGENT_RULES.md
- ARCHITECTURE_DECISIONS.md
- BUSINESS_RULES.md
- CEO_DIRECTIVES.md
- CHANGELOG.md
- COMPANY_BRAIN.md
- CRYSTAL_ADMIN_EXPERIENCE.md
- CRYSTAL_COMPONENT_LIBRARY.md
- CRYSTAL_CONSTITUTION.md
- CRYSTAL_CUSTOMER_EXPERIENCE.md
- CRYSTAL_DESIGN_SYSTEM.md
- CRYSTAL_ENV_ALIGNMENT_REPORT.md
- CRYSTAL_EVOLUTION_MASTERPLAN.md
- CRYSTAL_FRONTEND_AUDIT.md
- CRYSTAL_IMPLEMENTATION_SEQUENCE.md
- CRYSTAL_NAVIGATION_SYSTEM.md
- CRYSTAL_OS.md
- CRYSTAL_OS_2035.md
- CRYSTAL_OS_INFORMATION_ARCHITECTURE.md
- CRYSTAL_OS_MASTER_VISION.md
- CRYSTAL_OS_STRATEGIC_ALIGNMENT.md
- CRYSTAL_OS_V2_PHASE_1_REPORT.md
- CRYSTAL_OS_V2_PHASE_2_REPORT.md
- CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md
- CRYSTAL_OS_V2_STABILIZATION_REPORT.md
- CRYSTAL_OS_ZERO_BUGS_REPORT.md
- CRYSTAL_PRICIPLES.md
- CRYSTAL_REBUILD_MASTERPLAN.md
- CRYSTAL_SECRETARY_EXPERIENCE.md
- CRYSTAL_TECHNICIAN_EXPERIENCE.md
- CRYSTAL_UX_ARCHITECT_AUDIT.md
- CRYSTAL_UX_MASTERPLAN.md
- CRYSTAL_UX_PROBLEMS.md
- CRYSTAL_VISUAL_ANALYSIS.md
- CTO_DIRECTIVES.md
- DEFINITION_OF_DONE.md
- ENGINEERING_STANDARD.md
- ENV_SWITCH_REPORT.md
- EPICS.md
- FIELD_FEEDBACK.md
- IDEAS_BACKLOG.md
- OPERATIONS.md
- POOL_OS_REPORT.md
- PRODUCTION_AUDIT.md
- PRODUCTION_BOOTSTRAP_PLAN.md
- PRODUCTION_CLEAN_PLAN.md
- PRODUCTION_CLEAN_SAFETY_REPORT.md
- PRODUCTION_READY_REPORT.md
- PROJECT_MANIFEST.md
- PROJECT_VISION.md
- RC1_SAFE_IMPLEMENTATION_PLAN.md
- README_VPS_DEPLOY.md
- RELEASES.md
- ROADMAP.md
- STRATEGIC_BACKLOG_REPORT.md
- STRESS_001_BLOCKERS_FIX_REPORT.md
- STRESS_001_ROOT_CAUSE_REPORT.md
- STRESS_001_SHAKEDOWN_REPORT.md
- SUPABASE_FINAL_CLEAN_REPORT.md
- SUPABASE_FORENSIC_REPORT.md
- SUPABASE_MASTER_AUDIT.md
- SUPABASE_PRODUCTION_FIX_EXECUTION_REPORT.md
- SUPABASE_PRODUCTION_FIX_PLAN.md
- SUPABASE_PRODUCTION_READINESS_REPORT.md
- TECHNICIAN_OS_REPORT.md
- UX_COMPONENT_SYSTEM_REPORT.md
- UX_FINAL_IMPLEMENT_REPORT.md
- UX_REBUILD_MASTER_REPORT.md
- UX_REBUILD_PHASE_REPORT.md
- UX_VISUAL_PROTOTYPE_REPORT.md
- UX_VISUAL_REBUILD_REPORT.md
- VISION.md
- ZERO_BUGS_BACKEND_SECURITY_FIX_REPORT.md
- ZERO_BUGS_CLIENT_AUTH_DIAGNOSTIC.md
- ZERO_BUGS_FAILURE_DIAGNOSTIC.md
- ZERO_BUGS_REMAINING_FAILURES.md
- docs/FINAL_SECURITY_VALIDATION.md
- docs/FINAL_TEST_MATRIX.md
- docs/FINAL_UI_UX_AND_TEST_REPORT.md
- docs/FINAL_VISUAL_VALIDATION.md
- docs/QA_ENVIRONMENT_PROPOSAL.md
- docs/QA_FUNCTIONAL_EXECUTION_PLAN.md
- docs/RC1_SECURITY_MATRIX.md
- docs/UI_UX_AUDIT.md
- docs/UI_UX_PAGE_PROGRESS.md
- docs/UI_UX_REFACTOR_PLAN.md
- docs/product/CRYSTAL_WATER_AI_RULEBOOK.md
- docs/product/CRYSTAL_WATER_COMPONENT_LIBRARY.md
- docs/product/CRYSTAL_WATER_DESIGN_SPECIFICATION.md
- docs/product/CRYSTAL_WATER_EXPERIENCE_BIBLE.md
- docs/product/CRYSTAL_WATER_RELEASE_CHECKLIST.md
- docs/product/CRYSTAL_WATER_USER_FLOWS.md
- docs/product/CRYSTAL_WATER_VISUAL_REFERENCE.md
- docs/product/PHASE2_1_FOUNDATION_REPORT.md
- docs/product/PHASE2_LOTE_B_REPORT_20260713.md
- docs/product/PHASE2_LOTE_C_REPORT_20260714.md
- docs/product/PHASE2_LOTE_D_REPORT_20260714.md
- docs/product/PHASE2_LOTE_E_REPORT_20260714.md
- docs/product/PHASE2_LOTE_F_REPORT_20260714.md
- docs/product/PHASE2_LOTE_G_REPORT_20260714.md
- docs/product/PHASE2_LOT_20260713_REPORT.md
- docs/product/PHASE2_VISUAL_DECISION_LOG.md
- docs/product/evidence/
- docs/product/screenshots/phase2-lote-b/
- docs/product/screenshots/phase2-lote-c/
- docs/product/screenshots/phase2-lote-d/
- docs/product/screenshots/phase2-lote-e/
- docs/product/screenshots/phase2-lote-f/
- docs/product/screenshots/phase2-lote-g/
- docs/product/screenshots/phase2-lote-h/admin-ai-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ai-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-ai-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ai-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-company-closures-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-crm-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-crm-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-crm-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-crm-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-onboarding-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-operational-settings-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-payment-settings-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-security-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-security-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-security-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-security-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-technicians-390-light.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-1440-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-1440-light.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-390-dark.png
- docs/product/screenshots/phase2-lote-h/admin-ui-settings-390-light.png
- docs/product/screenshots/phase2-lote-h/alerts-1440-dark.png
- docs/product/screenshots/phase2-lote-h/alerts-1440-light.png
- docs/product/screenshots/phase2-lote-h/alerts-390-dark.png
- docs/product/screenshots/phase2-lote-h/alerts-390-light.png
- docs/product/screenshots/phase2-lote-h/billing-history-1440-dark.png
- docs/product/screenshots/phase2-lote-h/billing-history-1440-light.png
- docs/product/screenshots/phase2-lote-h/billing-history-390-dark.png
- docs/product/screenshots/phase2-lote-h/billing-history-390-light.png
- docs/product/screenshots/phase2-lote-h/client-wow-1440-dark.png
- docs/product/screenshots/phase2-lote-h/client-wow-1440-light.png
- docs/product/screenshots/phase2-lote-h/client-wow-390-dark.png
- docs/product/screenshots/phase2-lote-h/client-wow-390-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-1440-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-1440-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-390-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-390-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-1440-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-1440-light.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-390-dark.png
- docs/product/screenshots/phase2-lote-h/technician-profit-dashboard-390-light.png
- docs/product/screenshots/phase2-lote-h/to-issue-1440-dark.png
- docs/product/screenshots/phase2-lote-h/to-issue-1440-light.png
- docs/product/screenshots/phase2-lote-h/to-issue-390-dark.png
- docs/product/screenshots/phase2-lote-h/to-issue-390-light.png

### uploads/temp/logs
- (vazio)

### possivelmente gerado
- , v.status, v.active, v.createdAt.save
- frontend-backup-20260711-172931/
- package-lock.json

### outros
- , v.status, v.active, v.createdAt
- .gitignore
- : QA, mode: insensitive } },
- AS (
- c' },
- et
- et="utf-8">
- it" v WHERE v."clientId" IN (SELECT id FROM test_clients)
- it','Invoice')
- ole.error(e);
- ole.error(e); process.exit(1); }).finally(async ()=>{ await prisma.$disconnect(); });
- ole.log('FK_DEPENDENCIES');
- package.json
- prepare-production.js
- prisma/seed.js
- s AS referencing_table,
- s::text IN ('"Vehicle"','"Notification"','"Client"')
- t counts = await prisma.$queryRawUnsafe(`
- t prisma = new PrismaClient();
- t r of counts) {
- t_clients t ON t.id=c.id
- traints tc
- ync () => {
## 7) Processo na Porta 3002


```
LISTEN 0      511                *:3002             *:*    users:(("node /home/ubun",pid=524490,fd=22))
---
    PID    PPID                  STARTED     ELAPSED CMD
 524490    4719 Sun Jul 12 13:54:08 2026  6-23:17:38 node /home/ubuntu/systema/cristalwater_corrigido_testado_2
```

## 8) Health Check


```
{"ok":true,"status":"ONLINE","database":"ONLINE","at":"2026-07-19T13:11:47.002Z"}
```

## 9) Estado da Ligação à Base de Dados


```
Health endpoint:
{"ok":true,"status":"ONLINE","database":"ONLINE","at":"2026-07-19T13:11:47.002Z"}

Prisma migrate status:
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "cristalwater_production_20260707", schema "public" at "aws-0-eu-west-1.pooler.supabase.com:5432"

3 migrations found in prisma/migrations

Database schema is up to date!
```

## 10) Ambiente QA Seguro (somente leitura)

### .env

```
NODE_ENV=production
```

### env do processo atual

```
(vazio)
```

### avaliação
- NODE_ENV em .env está production (não é execução QA por defeito).
- QA_ENVIRONMENT_SAFE=true não está definido por defeito (deve ser definido no comando de teste).
- UPLOAD_DIR não definido por defeito (deve ser definido no comando de teste QA).
## 11) Migrations Existentes e Estado

### diretório prisma/migrations

```
20260605000000_v22_6_6_enterprise_safe_migration
20260605001000_v22_6_7_final_constraints_audit
20260614000100_add_pool_unique_constraints
```

### prisma migrate status (sem executar)

```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "cristalwater_production_20260707", schema "public" at "aws-0-eu-west-1.pooler.supabase.com:5432"

3 migrations found in prisma/migrations

Database schema is up to date!
```

## 12) Scripts Disponíveis no package.json


```
backup:db: node scripts/backup-database.js
check:syntax: node scripts/check-syntax.js
clean:vps: node scripts/clean-for-vps.js
cleanup:demo: node scripts/cleanup-demo-data.js
crystal:audit: node scripts/crystal-audit.js
dev: node src/server.js
doctor: node scripts/project-doctor.js
install:windows: powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1
preflight:v22: node scripts/preflight-static-v22.js
preflight:vps: node scripts/preflight-vps.js
prepare:vps: bash scripts/deploy-vps.sh
prisma:generate: prisma generate
prisma:migrate: prisma migrate dev
prisma:push: prisma db push
prisma:studio: prisma studio
prisma:validate: prisma validate
seed: node prisma/seed.js
smoke: node scripts/smoke-test.js
start: node src/server.js
start:windows: powershell -ExecutionPolicy Bypass -File scripts/start-windows.ps1
test: vitest run
test:admin-login: node scripts/test-admin-login-alias.js
test:calculations: node scripts/test-pool-calculations.js
test:closures: node scripts/test-company-closures.js
test:core-flow: node scripts/test-core-flow.js
test:enterprise: node scripts/test-functional-enterprise.js
test:final: npm run check:syntax && npm run test:v22.6.7 && npm run preflight:v22
test:final-two-years: node scripts/test-final-two-year-real-simulation.js
test:final-ux: npm run check:syntax && npm run test:ux-harmonized
test:flow: node scripts/test-operational-flow.js
test:functional: node scripts/test-functional-final.js
test:harmonized: node scripts/final-harmonized-static-test.js
test:interconnections: node scripts/test-system-interconnections.js
test:master-flow: node scripts/test-master-month-flow-stress.js
test:navigation-audit: node scripts/test-navigation-audit-v22.js
test:pool-create-flow: node scripts/test-pool-create-flow.js
test:production-ui: node scripts/test-production-ui-clean.js
test:readiness: node scripts/test-readiness.js
test:route-os-acceptance: node scripts/test-route-os-acceptance.js
test:technician: vitest run tests/technician-business.test.js
test:ux-harmonized: node scripts/test-ux-harmonized-v22.js
test:v16-ui: node scripts/test-v16-ui.js
test:v18-operational-state: node scripts/test-v18-operational-state.js
test:v21: npm run test:v21-schema && npm run test:v21-concurrency && npm run test:v21-freeze && npm run test:v21-frontend
test:v21-concurrency: node scripts/test-v21-concurrency.js
test:v21-freeze: node scripts/test-v21-freeze.js
test:v21-frontend: node scripts/test-v21-frontend-continuity.js
test:v21-schema: node scripts/test-v21-schema.js
test:v22.5.3.1: node scripts/test-v22-531-final.js
test:v22.6.0: node scripts/test-v226-crud-lifecycle.js
test:v22.6.1: node scripts/test-v2261-enterprise-final.js
test:v22.6.3: node scripts/test-v2263-crud-prisma-fix.js
test:v22.6.4: node scripts/test-v2264-deep-audit.js
test:v22.6.5: node scripts/test-v2265-enterprise-audit.js
test:v22.6.6: node scripts/test-v2266-enterprise-safe-migration.js
test:v22.6.7: node scripts/test-v2267-final-enterprise-audit.js
test:visit-os-operational: node scripts/test-visit-os-operational.js
```

## 13) Testes Existentes (E2E/Funcionais/Smoke/Módulo)

### tests/ (vitest e módulo)

```
tests/admin-weekly-planning-business.test.js
tests/assert-qa-environment-hardening.test.js
tests/client-portal.test.js
tests/customer-portal-service.test.js
tests/equipment-stock-os-business.test.js
tests/external-integration-killswitch.test.js
tests/finance-os-business.test.js
tests/load-env-qa-hardening.test.js
tests/pool-business.test.js
tests/pool-calculation-business.test.js
tests/pool-chat-business.test.js
tests/pool-equipment-installation.test.js
tests/pool-history-business.test.js
tests/pool-os-chemistry-workflow.test.js
tests/pool-os-maintenance-flow.test.js
tests/route-controller.test.js
tests/route-os-events.test.js
tests/security-controller.test.js
tests/service-visit-completion-flow.test.js
tests/technician-business.test.js
tests/technician-stats-business.test.js
tests/technician-visit-business.test.js
```

### scripts/ de teste funcional/smoke/e2e

```
(vazio)
```

### identificação rápida por categoria
- Smoke: npm run smoke -> scripts/smoke-test.js
- Funcionais: npm run test:functional, npm run test:enterprise, scripts/test-functional-*.js
- Operacionais por módulo: scripts/test-*-os-operational.js (administração, construção, cliente, stock, finanças, instalação, reparação, visita)
- Route/Visit/Pool/Technician específicos: múltiplos scripts test-route-os-acceptance, test-visit-os-operational, vitest tests/*business*.test.js
- E2E explícito por nome: não há suite Playwright/Cypress padrão; há testes de integração/funcionais via Node scripts.
## 14) Últimos 15 Commits


```
b6eedf5 PHASE2 Lote H final: corrigir guards TECHNICIAN e fechar auditoria sem regressões
f6551f9 TASK-0003.2 Technician Route Business base
3ff84c4 TASK-0003.1 Technician Dashboard Business integration
a423686 SPRINT-1 Create Technician OS business structure
d9096c1 SPRINT-A Add Crystal OS audit generator
ea8c138 SPRINT-0 Add Crystal OS kernel base
22cac6c Merge TASK-0002 Pools
ed13272 TASK-0002 Cleanup temporary pool business file
9d30943 TASK-0002.4 Extract pool lifecycle and delete to PoolBusiness
b274d06 TASK-0002.2 Extract createPool to PoolBusiness
8096b99 TASK-0002.1 Extract pool read operations to PoolBusiness
ae65a5e Merge TASK-0001 Clientes
be65174 TASK-0001.5 Complete client lifecycle and delete business migration
7c380bd TASK-0001.4 Extract updateClient to ClientBusiness
755b706 TASK-0001 Cleanup temporary backup files
```

## 15) Diferenças Desde o Commit b6eedf5

### commits após b6eedf5

```
(nenhum commit novo após b6eedf5)
```

### diff --stat b6eedf5

```
 .gitignore                                         |    5 +
 CHANGELOG.md                                       |   28 +
 README_VPS_DEPLOY.md                               |   47 +
 RELEASES.md                                        |   16 +
 ROADMAP.md                                         |  319 ++++-
 frontend/admin-ai.html                             |   16 +-
 frontend/admin-alerts.html                         |   17 +-
 frontend/admin-auth-guard.js                       |   57 +-
 frontend/admin-client-settings.html                |   94 +-
 frontend/admin-clients.html                        |   22 +-
 frontend/admin-collection.html                     |   10 +-
 frontend/admin-collection.js                       |  276 ++--
 frontend/admin-command-center.html                 |  379 +-----
 frontend/admin-company-closures.html               |   15 +-
 frontend/admin-core-flow.html                      |    6 +-
 frontend/admin-crm.html                            |   16 +-
 frontend/admin-dashboard.html                      |   89 +-
 frontend/admin-email-logs.html                     |   10 +-
 frontend/admin-email-logs.js                       |   56 +-
 frontend/admin-inventory.html                      |  120 +-
 frontend/admin-inventory.js                        |  235 +++-
 frontend/admin-keys.html                           |    6 +-
 frontend/admin-keys.js                             |    4 +-
 frontend/admin-live-map.html                       |   59 +-
 frontend/admin-login.html                          |    6 +-
 frontend/admin-map.html                            |   18 +-
 frontend/admin-map.js                              |  286 ++--
 frontend/admin-master-control.html                 |  794 ++++++++---
 frontend/admin-master-control.js                   |   78 +-
 frontend/admin-menu.html                           |  256 +++-
 frontend/admin-notifications.html                  |   10 +-
 frontend/admin-notifications.js                    |   26 +-
 frontend/admin-onboarding.html                     |   16 +-
 frontend/admin-operational-flow.html               |    7 +-
 frontend/admin-operational-settings.html           |   16 +-
 frontend/admin-operational-settings.js             |  191 +--
 frontend/admin-payment-settings.html               |   29 +-
 frontend/admin-payments.html                       |   71 +-
 frontend/admin-payments.js                         |  169 ++-
 frontend/admin-pool-calculator.html                |   15 +-
 frontend/admin-pool-technical.html                 |   12 +-
 frontend/admin-pools.html                          |   21 +-
 frontend/admin-priority.html                       |   83 +-
 frontend/admin-reports.html                        |   79 +-
 frontend/admin-reports.js                          |   73 +-
 frontend/admin-rounds.html                         |   14 +-
 frontend/admin-security.html                       |   14 +-
 frontend/admin-security.js                         |    6 +-
 frontend/admin-service-log.html                    |   11 +-
 frontend/admin-service-log.js                      |   10 +-
 frontend/admin-suppliers.html                      |   11 +-
 frontend/admin-technicians.html                    |   16 +-
 frontend/admin-test-center.html                    |    6 +-
 frontend/admin-today.html                          |  164 ++-
 frontend/admin-today.js                            |  302 ++++-
 frontend/admin-ui-settings.html                    |   22 +-
 frontend/admin-vehicles.html                       |   12 +-
 frontend/admin-vehicles.js                         |   14 +-
 frontend/admin-visits-dashboard.html               |   85 +-
 frontend/admin-visits.html                         |  110 +-
 frontend/alerts-financial.html                     |  194 ++-
 frontend/alerts.html                               |  266 +++-
 frontend/billing-center.html                       |   59 +-
 frontend/billing-center.js                         |  113 +-
 frontend/billing-extras.html                       |   61 +-
 frontend/billing-history.html                      |   40 +-
 frontend/billing.html                              |   10 +-
 frontend/billing.js                                |   77 +-
 frontend/chat.html                                 |    9 +-
 frontend/chat.js                                   |   12 +-
 frontend/client-auth-guard.js                      |    6 +
 frontend/client-dashboard.html                     |   17 +-
 frontend/client-dashboard.js                       |   78 +-
 frontend/client-history.html                       |   21 +-
 frontend/client-history.js                         |   34 +-
 frontend/client-login.html                         |    6 +-
 frontend/client-login.js                           |   34 +-
 frontend/client-menu.html                          |   21 +-
 frontend/client-notifications.html                 |   19 +-
 frontend/client-notifications.js                   |   22 +-
 frontend/client-payments.html                      |   19 +-
 frontend/client-payments.js                        |   10 +-
 frontend/client-portal.html                        |  644 +++++++--
 frontend/client-portal.js                          |  123 +-
 frontend/client-wow.html                           |   18 +-
 frontend/client-wow.js                             |    2 -
 frontend/client.html                               |   30 +-
 frontend/client.js                                 |   15 +-
 frontend/client_chat.html                          |   20 +-
 frontend/client_chat.js                            |  128 +-
 frontend/client_tech.html                          |   19 +-
 frontend/communications.html                       |   10 +-
 frontend/communications.js                         |   14 +-
 frontend/config-notifications.html                 |   10 +-
 frontend/cristal-assist.js                         |    5 +-
 frontend/cw-enterprise-sidebar.js                  |    4 +-
 frontend/cw-flow-shell.js                          |   61 +-
 frontend/cw-polish.css                             |   44 +
 frontend/dashboard.html                            |   16 +-
 frontend/dashboard.js                              |  131 +-
 frontend/gps.js                                    |   12 +-
 frontend/help-center.html                          |   10 +-
 frontend/incident-center.html                      |  712 ++--------
 frontend/invoices.html                             |   36 +-
 frontend/invoices.js                               |  201 +--
 frontend/js/offline/offline-gps.js                 |    9 +-
 frontend/js/offline/offline-queue.js               |   72 +-
 frontend/login.html                                |  530 +++-----
 frontend/map.html                                  |   91 +-
 frontend/metrics.html                              |   28 +-
 frontend/multi-map.html                            |  138 +-
 frontend/notifications.html                        |   10 +-
 frontend/notifications.js                          |  549 ++++----
 frontend/operational-dashboard.html                |   15 +-
 frontend/operational-dashboard.js                  |  204 +--
 frontend/profit-map.html                           |  142 +-
 frontend/ranking.html                              |   66 +-
 frontend/report-center.html                        |   39 +-
 frontend/report-settings.html                      |   10 +-
 frontend/report-settings.js                        |   16 +-
 frontend/route-map.html                            |   19 +-
 frontend/route-map.js                              |  112 +-
 frontend/settings.html                             |   69 +-
 frontend/splash.html                               |   37 +-
 frontend/technician-field-mode.html                | 1294 +++++++++---------
 frontend/technician-field-mode.js                  |   36 +-
 frontend/technician-gps.html                       |  170 ++-
 frontend/technician-guide.html                     |  172 ++-
 frontend/technician-guide.js                       |  153 ++-
 frontend/technician-login.html                     |    8 +-
 frontend/technician-map.html                       |  250 +++-
 frontend/technician-map.js                         |  253 +++-
 frontend/technician-new-client.html                |   17 +-
 frontend/technician-route.html                     |  206 ++-
 frontend/technician-route.js                       |  161 ++-
 frontend/technician-visit.html                     |  689 +++++++++-
 frontend/technician-visit.js                       |  335 ++++-
 frontend/technician.html                           |   61 +-
 frontend/technician.js                             |  335 +++--
 frontend/to-issue.html                             |   17 +-
 frontend/to-issue.js                               |   21 +-
 package-lock.json                                  | 1402 ++++++++++++++++++--
 package.json                                       |   14 +-
 prisma/seed.js                                     |  185 ++-
 scripts/test-core-flow.js                          |   17 +-
 scripts/test-final-two-year-real-simulation.js     |   81 +-
 scripts/test-system-interconnections.js            |   77 +-
 src/business/technician/TechnicianGpsBusiness.js   |  544 ++++++++
 src/business/technician/TechnicianRouteBusiness.js |  115 +-
 src/business/technician/TechnicianVisitBusiness.js |  570 ++++++++
 .../technician/TechnicianWorkdayBusiness.js        |   74 ++
 src/controllers/adminRoundsController.js           |   12 +
 src/controllers/aiOpsController.js                 |    5 +-
 src/controllers/authController.js                  |    3 +-
 src/controllers/clientAuthController.js            |    3 +-
 src/controllers/clientPortalController.js          |   60 +
 src/controllers/emailController.js                 |    7 +
 src/controllers/guideController.js                 |    3 +-
 src/controllers/inventoryController.js             |    3 +-
 src/controllers/invoiceController.js               |    2 +-
 src/controllers/paymentController.js               |    2 +-
 src/controllers/poolCalculationController.js       |  159 +--
 src/controllers/poolChatController.js              |   31 +-
 src/controllers/poolController.js                  |    7 +-
 src/controllers/poolEquipmentController.js         |  143 +-
 src/controllers/reminderController.js              |    6 +
 src/controllers/reportVisitController.js           |   21 +-
 src/controllers/routeController.js                 |   15 +
 src/controllers/securityController.js              |   47 +-
 src/controllers/technicalHistoryController.js      |   87 +-
 src/controllers/technicianAuthController.js        |   71 +-
 src/controllers/technicianController.js            |  149 +--
 src/controllers/technicianPortalController.js      |  287 +---
 src/controllers/technicianStatsController.js       |  102 +-
 src/controllers/visitController.js                 |  285 +---
 src/core/crystal/events/EventEngine.js             |    5 +
 src/core/crystal/permissions/PermissionGuardian.js |    9 +
 src/loadEnv.js                                     |   84 +-
 src/middlewares/aiAdminAuth.js                     |    3 +-
 src/middlewares/authJwt.js                         |   22 +-
 src/middlewares/authMiddleware.js                  |   29 +-
 src/routes/accessRoutes.js                         |    3 +-
 src/routes/adminAuthRoutes.js                      |    3 +-
 src/routes/adminPaymentRoutes.js                   |    3 +
 src/routes/adminReportsRoutes.js                   |    3 +
 src/routes/adminRoundsRoutes.js                    |   38 +-
 src/routes/clientAuthRoutes.js                     |   49 +-
 src/routes/clientMessageRoutes.js                  |    7 +-
 src/routes/clientPortalRoutes.js                   |  262 +++-
 src/routes/clientRoutes.js                         |    4 +
 src/routes/coreFlowRoutes.js                       |  106 +-
 src/routes/dashboardRoutes.js                      |    6 +-
 src/routes/documentRoutes.js                       |    5 +-
 src/routes/gpsRoutes.js                            |  565 +-------
 src/routes/guideRoutes.js                          |    6 +-
 src/routes/inventoryRoutes.js                      |    8 +-
 src/routes/invoiceRoutes.js                        |   10 +
 src/routes/operationalFlowRoutes.js                |   40 +-
 src/routes/poolEquipmentRoutes.js                  |   10 +
 src/routes/refreshTokenRoutes.js                   |    3 +-
 src/routes/repairRoutes.js                         |  456 +------
 src/routes/reportRoutes.js                         |   21 +
 src/routes/reportVisitRoutes.js                    |    3 +
 src/routes/searchRoutes.js                         |    3 +
 src/routes/serviceRoutes.js                        |    3 +
 src/routes/settingsRoutes.js                       |    3 +-
 src/routes/technicianRoutes.js                     |   46 +-
 src/routes/technicianWorkDayRoutes.js              |  106 +-
 src/routes/visitRoutes.js                          |  397 +++---
 src/routes/whatsappRoutes.js                       |   82 +-
 src/server.js                                      |   21 +-
 src/services/adminAuthService.js                   |    3 +-
 src/services/aiAdminActionService.js               |   16 +-
 src/services/aiOpsService.js                       |   17 +-
 src/services/emailService.js                       |  221 +--
 src/services/paymentReminderService.js             |    4 +-
 src/services/paymentService.js                     |    2 +-
 src/services/serviceVisitCompletionService.js      |  179 ++-
 src/services/whatsappService.js                    |  283 ++--
 src/socket/socketServer.js                         |    2 +
 220 files changed, 14827 insertions(+), 7595 deletions(-)
```

## 16) Separação: Conhecidas vs Suspeitas/Temporárias

### alterações conhecidas/legítimas (prováveis)
- frontend/ (múltiplas páginas e guards)
- src/ (business/controllers/routes/services)
- scripts/test-*.js e smoke/functionals
- docs/ relatórios e artefatos de produto
- package.json e package-lock.json (dependências/scripts)
### ficheiros/nomes suspeitos ou temporários
- , v.status, v.active, v.createdAt
- , v.status, v.active, v.createdAt.save
- : QA, mode: insensitive } },
- AS (
- et="utf-8">
- it" v WHERE v."clientId" IN (SELECT id FROM test_clients)
- ole.error(e);
- ole.error(e); process.exit(1); }).finally(async ()=>{ await prisma.$disconnect(); });
- ole.log('FK_DEPENDENCIES');
- s AS referencing_table,
- t counts = await prisma.$queryRawUnsafe(`
- t prisma = new PrismaClient();
- t r of counts) {
- ync () => {
## 17) Recomendação para Próxima Fase

- Recomenda-se revisão prévia dos ficheiros suspeitos/gerados antes do teste funcional completo.
- Se avançar no snapshot atual, documentar risco de falsos positivos por contaminação do working tree.
- Para execução QA segura, definir explicitamente QA_ENVIRONMENT_SAFE=true e UPLOAD_DIR dedicado no comando.

'use strict';
const auth = require('./authMiddleware');

// These legacy APIs expose global management data or actions. Field and client
// workflows use their own authenticated routers with resource ownership checks.
// Express mount paths match complete path segments (and the same casing rules
// as the routers), so /api/routes never intercepts /api/route.
const ADMIN_PATHS = Object.freeze([
  '/api/pools', '/api/reminders', '/api/routes', '/api/metrics',
  '/api/notification-rules', '/api/zones', '/api/extras', '/api/extra-visits',
  '/api/pool-equipment', '/api/poolEquipment', '/api/technical-history',
  '/api/technicalHistory', '/api/history', '/api/round-planner', '/api/admin',
  '/api/communications', '/api/location-logs', '/api/tasks', '/api/stats',
  '/api/customers', '/api/pool-calculations', '/api/calculator',
  '/api/company-closures', '/api/closures', '/api/operational-risk',
  '/api/ai', '/api/brain', '/api/platform', '/api/business', '/api/real-business'
]);

module.exports = function registerLegacyAdministrationAccess(app) {
  // Keep refused ledger responses private before this earlier ADMIN gate.
  app.use('/api/admin/payments/ledger/page', (req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');next();});
  app.use(ADMIN_PATHS, auth('ADMIN'));
};

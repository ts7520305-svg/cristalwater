'use strict';
const labor = require('./maintenanceLaborShareService'), material = require('./maintenanceMaterialShareService');
module.exports = {
  decorate: async (db, expenses) => material.decorate(db, await labor.decorate(db, expenses)),
  project: allocations => material.project(labor.project(allocations)),
  hasActive: async (db, allocations) => await labor.hasActive(db, allocations) || await material.hasActive(db, allocations)
};

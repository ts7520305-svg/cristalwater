const { buildContext, describeContext } = require("../context/CrystalContext");
const { getNextActions } = require("../flow/CrystalFlow");
const { hasPermission } = require("../permissions/PermissionGuardian");
const { createEvent } = require("../events/EventEngine");

function prepareAction(action, input = {}) {
  const context = buildContext(input.context || {});
  return {
    action,
    context: describeContext(context),
    nextActions: getNextActions(context),
    requiresConfirmation: true,
    preparedAt: new Date().toISOString(),
  };
}

function canExecute(role, permission) {
  return hasPermission(role, permission);
}

module.exports = {
  buildContext,
  describeContext,
  getNextActions,
  createEvent,
  prepareAction,
  canExecute,
};

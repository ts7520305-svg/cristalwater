class PermissionEngine {
  constructor() {
    this.rules = [];
  }

  allow({ role, action, resource }) {
    this.rules.push({ role, action, resource });
    return true;
  }

  can({ role, action, resource }) {
    return this.rules.some((rule) => {
      return (
        rule.role === role &&
        rule.action === action &&
        rule.resource === resource
      );
    });
  }

  listRules() {
    return this.rules;
  }
}

module.exports = new PermissionEngine();

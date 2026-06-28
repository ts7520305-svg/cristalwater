class ModuleRegistry {

  constructor() {
    this.modules = {};
  }

  register(name, moduleData) {

    this.modules[name] = {

      ...moduleData,

      registeredAt: new Date().toISOString()

    };

    return this.modules[name];

  }

  get(name) {
    return this.modules[name] || null;
  }

  all() {
    return this.modules;
  }

}

module.exports = new ModuleRegistry();

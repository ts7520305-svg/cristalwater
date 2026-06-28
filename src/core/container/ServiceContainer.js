class ServiceContainer {

  constructor() {
    this.services = new Map();
  }

  register(name, service) {

    if (!name)
      throw new Error("Service name obrigatório.");

    this.services.set(name, service);

    return service;
  }

  resolve(name) {

    if (!this.services.has(name))
      throw new Error(`Serviço '${name}' não encontrado.`);

    return this.services.get(name);

  }

  has(name) {
    return this.services.has(name);
  }

  list() {
    return [...this.services.keys()];
  }

}

module.exports = new ServiceContainer();

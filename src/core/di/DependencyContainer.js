class DependencyContainer {

    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }

    register(name, factory, singleton = true) {

        this.services.set(name, {
            factory,
            singleton
        });

    }

    resolve(name) {

        if (this.singletons.has(name))
            return this.singletons.get(name);

        const definition = this.services.get(name);

        if (!definition)
            throw new Error(`Dependency '${name}' não encontrada.`);

        const instance = definition.factory();

        if (definition.singleton)
            this.singletons.set(name, instance);

        return instance;

    }

    has(name) {
        return this.services.has(name);
    }

    list() {
        return [...this.services.keys()];
    }

}

module.exports = new DependencyContainer();

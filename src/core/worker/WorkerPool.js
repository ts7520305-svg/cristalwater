class WorkerPool {

    constructor() {
        this.workers = [];
        this.pointer = 0;
    }

    register(name, handler) {

        this.workers.push({
            id: `worker_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
            name,
            handler,
            busy: false,
            executions: 0,
            lastExecution: null
        });

    }

    next() {

        if (this.workers.length === 0)
            throw new Error("Não existem workers.");

        const worker = this.workers[this.pointer];

        this.pointer++;

        if (this.pointer >= this.workers.length)
            this.pointer = 0;

        return worker;

    }

    async execute(payload = {}) {

        const worker = this.next();

        worker.busy = true;

        const started = Date.now();

        const result = await worker.handler(payload);

        worker.busy = false;

        worker.executions++;

        worker.lastExecution = new Date().toISOString();

        return {
            worker: worker.name,
            executionTime: Date.now() - started,
            result
        };

    }

    status() {

        return this.workers.map(w => ({
            id: w.id,
            name: w.name,
            busy: w.busy,
            executions: w.executions,
            lastExecution: w.lastExecution
        }));

    }

}

module.exports = new WorkerPool();

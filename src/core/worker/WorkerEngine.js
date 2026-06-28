class WorkerEngine {

    constructor() {
        this.workers = [];
    }

    register(name, handler) {

        this.workers.push({

            id: `worker_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,

            name,

            status: "idle",

            handler,

            createdAt: new Date().toISOString()

        });

    }

    async execute(name,payload={}){

        const worker=this.workers.find(w=>w.name===name);

        if(!worker)
            throw new Error("Worker não encontrado.");

        worker.status="running";

        const started=Date.now();

        const result=await worker.handler(payload);

        worker.status="idle";

        return{

            ok:true,

            worker:name,

            executionTime:Date.now()-started,

            result

        };

    }

    list(){

        return this.workers.map(w=>({

            id:w.id,

            name:w.name,

            status:w.status

        }));

    }

}

module.exports=new WorkerEngine();

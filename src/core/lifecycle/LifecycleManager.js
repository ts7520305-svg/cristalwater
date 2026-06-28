class LifecycleManager {

    constructor() {

        this.modules = new Map();

    }

    register(name) {

        this.modules.set(name,{
            name,
            status:"stopped",
            startedAt:null
        });

    }

    start(name){

        const m=this.modules.get(name);

        if(!m)
            throw new Error("Módulo inexistente.");

        m.status="running";
        m.startedAt=new Date().toISOString();

        return m;

    }

    stop(name){

        const m=this.modules.get(name);

        if(!m)
            throw new Error("Módulo inexistente.");

        m.status="stopped";

        return m;

    }

    restart(name){

        this.stop(name);

        return this.start(name);

    }

    status(){

        return [...this.modules.values()];

    }

}

module.exports=new LifecycleManager();

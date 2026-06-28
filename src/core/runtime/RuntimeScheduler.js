class RuntimeScheduler {

    constructor(){

        this.jobs=[];

    }

    add(name,intervalSeconds,handler){

        this.jobs.push({

            id:`job_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,

            name,

            intervalSeconds,

            handler,

            enabled:true,

            executions:0,

            lastRun:null

        });

    }

    async runOnce(){

        for(const job of this.jobs){

            if(!job.enabled)
                continue;

            await job.handler();

            job.executions++;

            job.lastRun=new Date().toISOString();

        }

    }

    list(){

        return this.jobs;

    }

}

module.exports=new RuntimeScheduler();

class QueueEngine {

    constructor() {
        this.queue = [];
        this.processing = false;
    }

    push(job) {

        this.queue.push({
            id: `queue_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
            createdAt: new Date().toISOString(),
            status: "pending",
            ...job
        });

        return this.queue[this.queue.length-1];

    }

    size() {
        return this.queue.length;
    }

    next() {

        return this.queue.find(j => j.status === "pending");

    }

    async process(workerEngine) {

        if(this.processing)
            return;

        this.processing = true;

        while(true){

            const job=this.next();

            if(!job)
                break;

            job.status="running";

            try{

                job.result=await workerEngine.execute(job.worker,job.payload);

                job.status="done";

            }catch(err){

                job.status="failed";

                job.error=err.message;

            }

        }

        this.processing=false;

    }

    list(){

        return this.queue;

    }

}

module.exports=new QueueEngine();

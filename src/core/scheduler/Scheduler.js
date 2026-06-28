class Scheduler {

  constructor() {
    this.jobs = [];
  }

  register(name, cron, handler) {

    this.jobs.push({
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      name,
      cron,
      handler,
      enabled: true,
      createdAt: new Date().toISOString()
    });

  }

  list() {
    return this.jobs;
  }

  enable(name) {
    const j=this.jobs.find(x=>x.name===name);
    if(j) j.enabled=true;
  }

  disable(name) {
    const j=this.jobs.find(x=>x.name===name);
    if(j) j.enabled=false;
  }

}

module.exports = new Scheduler();

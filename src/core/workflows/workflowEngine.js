const workflows = new Map();

function startWorkflow({
  type,
  entityType,
  entityId,
  steps = []
}) {

  if (!type) {
    throw new Error("Workflow type is required");
  }

  const workflow = {
    id: Date.now().toString(),
    type,
    entityType,
    entityId,
    status: "ACTIVE",
    currentStep: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    steps: steps.map(step => ({
      name: step,
      completed: false,
      completedAt: null
    }))
  };

  workflows.set(workflow.id, workflow);

  return workflow;
}

function completeStep(workflowId) {

  const workflow = workflows.get(workflowId);

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const step = workflow.steps[workflow.currentStep];

  if (!step) {
    workflow.status = "COMPLETED";
    workflow.completedAt = new Date().toISOString();
    return workflow;
  }

  step.completed = true;
  step.completedAt = new Date().toISOString();

  workflow.currentStep++;

  if (workflow.currentStep >= workflow.steps.length) {
    workflow.status = "COMPLETED";
    workflow.completedAt = new Date().toISOString();
  }

  return workflow;
}

function getWorkflow(workflowId) {
  return workflows.get(workflowId);
}

module.exports = {
  startWorkflow,
  completeStep,
  getWorkflow
};

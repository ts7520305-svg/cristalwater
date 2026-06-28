function buildHistoryContext(history = {}) {
  return {
    type: "history_context",
    customerHistory: history.customerHistory || [],
    poolHistory: history.poolHistory || [],
    technicianHistory: history.technicianHistory || [],
    chemicalHistory: history.chemicalHistory || [],
    repairHistory: history.repairHistory || [],
    alertHistory: history.alertHistory || [],
    billingHistory: history.billingHistory || [],
    summary: history.summary || "",
  };
}

module.exports = {
  buildHistoryContext,
};

function buildBusinessContext(data = {}) {
  return {
    type: "business_context",
    generatedAt: new Date().toISOString(),

    totals: {
      customers: data.customersCount || 0,
      pools: data.poolsCount || 0,
      technicians: data.techniciansCount || 0,
      visitsToday: data.visitsTodayCount || 0,
      openAlerts: data.openAlertsCount || 0,
      unpaidInvoices: data.unpaidInvoicesCount || 0,
    },

    priorities: data.priorities || [],
    risks: data.risks || [],
    notes: data.notes || "",
  };
}

module.exports = {
  buildBusinessContext,
};

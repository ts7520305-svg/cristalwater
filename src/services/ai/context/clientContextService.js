const { searchClients, getClientFullProfile } = require("../data/clientData");

function sanitizeClientProfile(client) {
  if (!client) return null;

  return {
    id: client.id,
    name: client.name,
    internalName: client.internalName,
    email: client.email,
    phone: client.phone,
    address: client.address,
    zone: client.zone,
    status: client.status,
    active: client.active,
    monthlyFee: client.monthlyFee,
    monthlyAmount: client.monthlyAmount,
    creditBalance: client.creditBalance,
    paymentStatus: client.paymentStatus,
    requiresInvoice: client.requiresInvoice,
    billingActive: client.billingActive,
    fiscalName: client.fiscalName,
    fiscalNif: client.fiscalNif,
    fiscalAddress: client.fiscalAddress,
    fiscalEmail: client.fiscalEmail,
    archiveStatus: client.archiveStatus,
    contractActive: client.contractActive,
    pools: client.pools || [],
    invoices: client.invoices || [],
    serviceVisits: client.serviceVisits || [],
    visits: client.visits || [],
    tasks: client.tasks || [],
    attachments: client.attachments || [],
    communicationLogs: client.communicationLogs || [],
    notifications: client.notifications || [],
  };
}

async function buildClientContextFromQuery(query) {
  const matches = await searchClients(query, 5);

  if (!matches.length) {
    return {
      type: "client_context",
      found: false,
      query,
      message: "Nenhum cliente encontrado.",
    };
  }

  const bestMatch = matches[0];
  const fullProfile = await getClientFullProfile(bestMatch.id);

  return {
    type: "client_context",
    found: true,
    query,
    matches: matches.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      zone: client.zone,
    })),
    client: sanitizeClientProfile(fullProfile),
  };
}

module.exports = {
  buildClientContextFromQuery,
};

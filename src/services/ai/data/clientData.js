const prisma = require("../../../prismaClient");

function normalize(value = "") {
  return String(value).trim();
}

async function getRecentClients(limit = 10) {
  return prisma.client.findMany({
    take: limit,
    orderBy: { id: "desc" },
    include: {
      pools: true,
      invoices: {
        take: 5,
        orderBy: { id: "desc" },
      },
      serviceVisits: {
        take: 5,
        orderBy: { id: "desc" },
      },
      visits: {
        take: 5,
        orderBy: { id: "desc" },
      },
    },
  });
}

async function searchClients(query, limit = 10) {
  const q = normalize(query);

  if (!q) return [];

  return prisma.client.findMany({
    take: limit,
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { internalName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { fiscalEmail: { contains: q, mode: "insensitive" } },
        { fiscalAddress: { contains: q, mode: "insensitive" } },
        { zone: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      pools: true,
      invoices: {
        take: 5,
        orderBy: { id: "desc" },
      },
      serviceVisits: {
        take: 5,
        orderBy: { id: "desc" },
      },
      visits: {
        take: 5,
        orderBy: { id: "desc" },
      },
    },
    orderBy: { id: "desc" },
  });
}

async function getClientFullProfile(clientId) {
  return prisma.client.findUnique({
    where: {
      id: Number(clientId),
    },
    include: {
      pools: true,
      invoices: {
        take: 10,
        orderBy: { id: "desc" },
      },
      serviceVisits: {
        take: 10,
        orderBy: { id: "desc" },
      },
      visits: {
        take: 10,
        orderBy: { id: "desc" },
      },
      tasks: {
        take: 10,
        orderBy: { id: "desc" },
      },
      attachments: {
        take: 10,
        orderBy: { id: "desc" },
      },
      communicationLogs: {
        take: 10,
        orderBy: { id: "desc" },
      },
      notifications: {
        take: 10,
        orderBy: { id: "desc" },
      },
    },
  });
}

module.exports = {
  getRecentClients,
  searchClients,
  getClientFullProfile,
};

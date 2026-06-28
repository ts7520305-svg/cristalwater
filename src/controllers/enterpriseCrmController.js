const { prisma } = require("../prismaClient");

function toDate(value) { return value ? new Date(value) : null; }
function isValidDate(d) { return d instanceof Date && !Number.isNaN(d.getTime()); }

async function listLeads(req, res) {
  const { status, q } = req.query;
  const where = {};
  if (status && status !== "ALL") where.status = status;
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
    { zone: { contains: q, mode: "insensitive" } },
    { notes: { contains: q, mode: "insensitive" } },
  ];
  const leads = await prisma.lead.findMany({ where, include: { activities: { orderBy: { createdAt: "desc" }, take: 5 }, appointments: { orderBy: { startsAt: "asc" }, take: 3 } }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }] });
  res.json({ ok: true, leads });
}

async function createLead(req, res) {
  const data = req.body || {};
  if (!data.name) return res.status(400).json({ ok: false, error: "Nome obrigatório" });
  const lead = await prisma.lead.create({ data: {
    name: data.name, internalName: data.internalName || null, phone: data.phone || null, email: data.email || null,
    address: data.address || null, zone: data.zone || null, latitude: data.latitude ? Number(data.latitude) : null,
    longitude: data.longitude ? Number(data.longitude) : null, source: data.source || "MANUAL", status: data.status || "NEW",
    priority: data.priority || "NORMAL", estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : 0,
    poolType: data.poolType || null, notes: data.notes || null, assignedTo: data.assignedTo || null,
    nextFollowUpAt: isValidDate(toDate(data.nextFollowUpAt)) ? toDate(data.nextFollowUpAt) : null,
    activities: { create: { type: "CREATED", title: "Lead criado", description: data.notes || null, createdBy: data.createdBy || "system" } }
  }});
  res.status(201).json({ ok: true, lead });
}

async function updateLead(req, res) {
  const id = Number(req.params.id);
  const data = req.body || {};
  const update = { ...data };
  if (data.estimatedValue !== undefined) update.estimatedValue = Number(data.estimatedValue || 0);
  if (data.latitude !== undefined) update.latitude = data.latitude === null || data.latitude === "" ? null : Number(data.latitude);
  if (data.longitude !== undefined) update.longitude = data.longitude === null || data.longitude === "" ? null : Number(data.longitude);
  if (data.nextFollowUpAt !== undefined) update.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
  const lead = await prisma.lead.update({ where: { id }, data: update });
  await prisma.leadActivity.create({ data: { leadId: id, type: "UPDATED", title: "Lead atualizado", createdBy: data.updatedBy || "system" } }).catch(()=>{});
  res.json({ ok: true, lead });
}

async function addLeadActivity(req, res) {
  const leadId = Number(req.params.id);
  const data = req.body || {};
  const activity = await prisma.leadActivity.create({ data: { leadId, type: data.type || "NOTE", title: data.title || "Nota", description: data.description || data.notes || null, createdBy: data.createdBy || "system" }});
  res.status(201).json({ ok: true, activity });
}

async function convertLeadToClient(req, res) {
  const id = Number(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return res.status(404).json({ ok: false, error: "Lead não encontrado" });
  const client = await prisma.client.create({ data: { name: lead.name, internalName: lead.internalName, email: lead.email, phone: lead.phone, address: lead.address, zone: lead.zone, latitude: lead.latitude, longitude: lead.longitude, notes: `Convertido de lead #${lead.id}. ${lead.notes || ""}`.trim(), status: "ACTIVE", active: true }});
  await prisma.pool.create({ data: { clientId: client.id, name: req.body?.poolName || `Piscina ${lead.name}`, address: lead.address, zone: lead.zone, latitude: lead.latitude, longitude: lead.longitude, type: lead.poolType || null, notes: "Criada automaticamente na conversão de lead" }}).catch(()=>{});
  await prisma.lead.update({ where: { id }, data: { status: "CONVERTED", convertedClientId: client.id }});
  await prisma.leadActivity.create({ data: { leadId: id, type: "CONVERTED", title: "Convertido em cliente", description: `Cliente #${client.id}`, createdBy: req.body?.createdBy || "system" }}).catch(()=>{});
  res.json({ ok: true, clientId: client.id, client });
}

async function listAppointments(req, res) {
  const { status, from, to } = req.query;
  const where = {};
  if (status && status !== "ALL") where.status = status;
  if (from || to) where.startsAt = {};
  if (from) where.startsAt.gte = new Date(from);
  if (to) where.startsAt.lte = new Date(to);
  const appointments = await prisma.appointment.findMany({ where, orderBy: { startsAt: "asc" }, take: 500 });
  res.json({ ok: true, appointments });
}

async function createAppointment(req, res) {
  const data = req.body || {};
  if (!data.title || !data.startsAt) return res.status(400).json({ ok: false, error: "Título e data/hora obrigatórios" });
  const appointment = await prisma.appointment.create({ data: {
    title: data.title, description: data.description || null, appointmentType: data.appointmentType || "GENERAL", status: data.status || "SCHEDULED",
    startsAt: new Date(data.startsAt), endsAt: data.endsAt ? new Date(data.endsAt) : null, location: data.location || null,
    latitude: data.latitude ? Number(data.latitude) : null, longitude: data.longitude ? Number(data.longitude) : null,
    clientId: data.clientId ? Number(data.clientId) : null, poolId: data.poolId ? Number(data.poolId) : null, leadId: data.leadId ? Number(data.leadId) : null,
    technicianId: data.technicianId ? Number(data.technicianId) : null, assignedTo: data.assignedTo || null, notes: data.notes || null,
    reminder2d: data.reminder2d !== false, reminder1d: data.reminder1d !== false, reminderSameDay: data.reminderSameDay !== false
  }});
  res.status(201).json({ ok: true, appointment });
}

async function updateAppointment(req, res) {
  const id = Number(req.params.id);
  const data = { ...req.body };
  if (data.startsAt) data.startsAt = new Date(data.startsAt);
  if (data.endsAt) data.endsAt = new Date(data.endsAt);
  ["clientId","poolId","leadId","technicianId"].forEach(k=>{ if(data[k] !== undefined && data[k] !== null && data[k] !== "") data[k] = Number(data[k]); });
  const appointment = await prisma.appointment.update({ where: { id }, data });
  res.json({ ok: true, appointment });
}

async function listReminders(req, res) {
  const { status, category } = req.query;
  const where = {};
  if (status && status !== "ALL") where.status = status;
  if (category && category !== "ALL") where.category = category;
  const reminders = await prisma.generalReminder.findMany({ where, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 500 });
  res.json({ ok: true, reminders });
}

async function createReminder(req, res) {
  const data = req.body || {};
  if (!data.title || !data.dueAt) return res.status(400).json({ ok: false, error: "Título e data obrigatórios" });
  const reminder = await prisma.generalReminder.create({ data: {
    title: data.title, description: data.description || null, category: data.category || "GENERAL", priority: data.priority || "NORMAL", status: data.status || "PENDING",
    dueAt: new Date(data.dueAt), clientId: data.clientId ? Number(data.clientId) : null, poolId: data.poolId ? Number(data.poolId) : null,
    leadId: data.leadId ? Number(data.leadId) : null, appointmentId: data.appointmentId ? Number(data.appointmentId) : null, technicianId: data.technicianId ? Number(data.technicianId) : null,
    repeatRule: data.repeatRule || null, createdBy: data.createdBy || "system"
  }});
  res.status(201).json({ ok: true, reminder });
}

async function completeReminder(req, res) {
  const id = Number(req.params.id);
  const reminder = await prisma.generalReminder.update({ where: { id }, data: { status: "DONE", completedAt: new Date() }});
  res.json({ ok: true, reminder });
}

module.exports = {
  listLeads,
  createLead,
  updateLead,
  addLeadActivity,
  convertLeadToClient,
  listAppointments,
  createAppointment,
  updateAppointment,
  listReminders,
  createReminder,
  completeReminder,
};

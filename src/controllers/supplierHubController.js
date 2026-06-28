const { prisma } = require("../prismaClient");
const { encryptSecret, decryptSecret, maskSecret } = require("../services/credentialVaultService");

function cleanSupplier(s, reveal = false) {
  if (!s) return s;
  return { ...s, password: reveal ? decryptSecret(s.encryptedPassword) : maskSecret(s.encryptedPassword), encryptedPassword: undefined };
}

async function listSuppliers(req, res) {
  const { q, category, active } = req.query;
  const where = {};
  if (category && category !== "ALL") where.category = category;
  if (active !== undefined) where.active = String(active) !== "false";
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } },
    { username: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }
  ];
  const suppliers = await prisma.supplierAccount.findMany({ where, include: { links: { where: { active: true }, orderBy: [{ favorite: "desc" }, { title: "asc" }] } }, orderBy: [{ favorite: "desc" }, { name: "asc" }] });
  res.json({ ok: true, suppliers: suppliers.map(s => cleanSupplier(s)) });
}

async function createSupplier(req, res) {
  const data = req.body || {};
  if (!data.name) return res.status(400).json({ ok: false, error: "Nome obrigatório" });
  const supplier = await prisma.supplierAccount.create({ data: {
    name: data.name, category: data.category || null, website: data.website || null, loginUrl: data.loginUrl || data.website || null,
    username: data.username || null, encryptedPassword: encryptSecret(data.password), passwordHint: data.passwordHint || null,
    contactName: data.contactName || null, phone: data.phone || null, email: data.email || null, address: data.address || null,
    nif: data.nif || null, discountNotes: data.discountNotes || null, paymentTerms: data.paymentTerms || null, notes: data.notes || null,
    favorite: !!data.favorite, active: data.active !== false
  }});
  res.status(201).json({ ok: true, supplier: cleanSupplier(supplier) });
}

async function updateSupplier(req, res) {
  const id = Number(req.params.id);
  const data = { ...req.body };
  if (data.password !== undefined) { data.encryptedPassword = data.password ? encryptSecret(data.password) : null; delete data.password; }
  const supplier = await prisma.supplierAccount.update({ where: { id }, data });
  res.json({ ok: true, supplier: cleanSupplier(supplier) });
}

async function revealSupplierPassword(req, res) {
  const id = Number(req.params.id);
  const supplier = await prisma.supplierAccount.update({ where: { id }, data: { lastAccessAt: new Date() } });
  res.json({ ok: true, id, password: decryptSecret(supplier.encryptedPassword) });
}

async function listQuickLinks(req, res) {
  const links = await prisma.supplierQuickLink.findMany({ where: { active: true }, include: { supplier: true }, orderBy: [{ favorite: "desc" }, { category: "asc" }, { title: "asc" }] });
  res.json({
    ok: true,
    links: links.map((link) => ({
      ...link,
      supplier: link.supplier ? cleanSupplier(link.supplier) : null
    }))
  });
}

async function createQuickLink(req, res) {
  const data = req.body || {};
  if (!data.title || !data.url) return res.status(400).json({ ok: false, error: "Título e URL obrigatórios" });
  const link = await prisma.supplierQuickLink.create({ data: { supplierId: data.supplierId ? Number(data.supplierId) : null, title: data.title, url: data.url, category: data.category || "GENERAL", notes: data.notes || null, favorite: !!data.favorite, active: data.active !== false }});
  res.status(201).json({ ok: true, link });
}

module.exports = { listSuppliers, createSupplier, updateSupplier, revealSupplierPassword, listQuickLinks, createQuickLink };

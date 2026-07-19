const express = require('express');
const prisma = require('../prismaClient');
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

function q(v){ return String(v || '').trim(); }
function contains(term){ return { contains: term, mode: 'insensitive' }; }

router.use(auth("ADMIN"));

router.get('/', async (req, res) => {
  const term = q(req.query.q || req.query.search);
  if (!term || term.length < 2) return res.json({ ok: true, term, results: [] });
  try {
    const [clients, pools, technicians, vehicles, products, guides, keys] = await Promise.all([
      prisma.client.findMany({ where: { OR: [{ name: contains(term) }, { internalName: contains(term) }, { zone: contains(term) }, { phone: contains(term) }, { email: contains(term) }] }, select: { id: true, name: true, zone: true, phone: true, active: true }, take: 15 }).catch(()=>[]),
      prisma.pool.findMany({ where: { OR: [{ name: contains(term) }, { location: contains(term) }, { zone: contains(term) }, { address: contains(term) }] }, select: { id: true, name: true, zone: true, location: true, client: { select: { id: true, name: true } } }, take: 15 }).catch(()=>[]),
      prisma.technician.findMany({ where: { OR: [{ name: contains(term) }, { email: contains(term) }, { phone: contains(term) }, { zone: contains(term) }] }, select: { id: true, name: true, email: true, phone: true, active: true }, take: 15 }).catch(()=>[]),
      prisma.vehicle.findMany({ where: { OR: [{ plate: contains(term) }, { name: contains(term) }, { brand: contains(term) }, { model: contains(term) }] }, select: { id: true, plate: true, name: true, status: true, active: true }, take: 15 }).catch(()=>[]),
      prisma.inventoryProduct.findMany({ where: { OR: [{ name: contains(term) }, { sku: contains(term) }, { brand: contains(term) }, { category: contains(term) }] }, select: { id: true, name: true, sku: true, unit: true, active: true }, take: 15 }).catch(()=>[]),
      prisma.transportGuide.findMany({ where: { OR: [{ codeAT: contains(term) }, { origin: contains(term) }, { destination: contains(term) }] }, select: { id: true, codeAT: true, status: true, vehicle: { select: { id: true, plate: true } } }, take: 15 }).catch(()=>[]),
      prisma.clientAccess.findMany({ where: { accessType: 'KEY', OR: [{ codeValue: contains(term) }, { title: contains(term) }, { instructions: contains(term) }] }, select: { id: true, title: true, codeValue: true, client: { select: { id: true, name: true } } }, take: 15 }).catch(()=>[]),
    ]);
    const results = [
      ...clients.map(x => ({ type: 'CLIENT', id: x.id, label: x.name, detail: x.zone || x.phone, url: `/admin-clients?id=${x.id}` })),
      ...pools.map(x => ({ type: 'POOL', id: x.id, label: x.name || `Piscina ${x.id}`, detail: `${x.client?.name || ''} ${x.zone || x.location || ''}`.trim(), url: `/admin-pools?id=${x.id}` })),
      ...technicians.map(x => ({ type: 'TECHNICIAN', id: x.id, label: x.name, detail: x.email || x.phone, url: `/admin-technicians?id=${x.id}` })),
      ...vehicles.map(x => ({ type: 'VEHICLE', id: x.id, label: x.plate, detail: x.name || x.status, url: `/admin-vehicles?id=${x.id}` })),
      ...products.map(x => ({ type: 'PRODUCT', id: x.id, label: x.name, detail: `${x.sku || ''} ${x.unit || ''}`.trim(), url: `/admin-inventory?id=${x.id}` })),
      ...guides.map(x => ({ type: 'TRANSPORT_GUIDE', id: x.id, label: x.codeAT || `Guia ${x.id}`, detail: x.vehicle?.plate || x.status, url: `/admin-vehicles?guideId=${x.id}` })),
      ...keys.map(x => ({ type: 'KEY', id: x.id, label: x.codeValue || x.title, detail: x.client?.name || '', url: `/admin-keys?id=${x.id}` })),
    ];
    res.json({ ok: true, term, results });
  } catch (error) { res.status(500).json({ ok: false, error: error.message }); }
});
module.exports = router;

const bcrypt = require("bcrypt");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.EQUIPMENT_STOCK_OS_BASE_URL || "http://127.0.0.1:3002/api";
const RUN_ID = `EQUIP-STOCK-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  return { response, data };
}

async function main() {
  const created = { technicianId: null, clientId: null, poolId: null, equipmentId: null, visitId: null };

  try {
    const technician = await prisma.technician.create({
      data: {
        name: `Tech ${RUN_ID}`,
        pin: String(Date.now()).slice(-6),
        role: "TECHNICIAN",
        active: true,
      },
    });
    created.technicianId = technician.id;

    const client = await prisma.client.create({
      data: {
        name: `Client ${RUN_ID}`,
        email: `equip-stock-${Date.now()}@example.com`,
        password: await bcrypt.hash("EquipStock123!", 10),
        active: true,
      },
    });
    created.clientId = client.id;

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `Pool ${RUN_ID}`,
        active: true,
        type: "POOL",
      },
    });
    created.poolId = pool.id;

    const equipment = await prisma.poolEquipment.create({
      data: {
        poolId: pool.id,
        type: "PUMP",
        brand: "QA",
        model: "Q-100",
      },
    });
    created.equipmentId = equipment.id;

    const visit = await prisma.serviceVisit.create({
      data: {
        clientId: client.id,
        poolId: pool.id,
        technicianId: technician.id,
        technicianName: technician.name,
        status: "PLANNED",
        plannedDate: new Date(),
        date: new Date(),
      },
    });
    created.visitId = visit.id;

    const productName = "CLORO LIQUIDO QA";
    await prisma.inventoryProduct.create({
      data: {
        name: productName,
        sku: `SKU-${RUN_ID}`,
        unit: "L",
        minStockCentral: 5,
        minStockVehicle: 2,
        active: true,
      },
    });

    await prisma.stockBalance.create({
      data: {
        scope: "CENTRAL",
        productName,
        unit: "L",
        quantity: 20,
      },
    });

    const login = await fetchJson(`${BASE_URL}/technician-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: technician.pin }),
    });
    assert(login.response.ok && login.data.ok, `tech login failed: ${JSON.stringify(login.data)}`);

    const headers = {
      Authorization: `Bearer ${login.data.token}`,
      "Content-Type": "application/json",
    };

    const inventory = await fetchJson(`${BASE_URL}/equipment-stock-os/equipment`, { headers });
    assert(inventory.response.ok && inventory.data.ok, "equipment inventory failed");

    const lifecycle = await fetchJson(`${BASE_URL}/equipment-stock-os/equipment/${equipment.id}/lifecycle`, { headers });
    assert(lifecycle.response.ok && lifecycle.data.ok, "equipment lifecycle failed");

    const maintenance = await fetchJson(`${BASE_URL}/equipment-stock-os/equipment/${equipment.id}/maintenance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "Inspecao preventiva", dueAt: new Date(Date.now() + 86400000).toISOString() }),
    });
    assert(maintenance.response.ok && maintenance.data.ok, "maintenance scheduling failed");

    const transfer = await fetchJson(`${BASE_URL}/equipment-stock-os/stock/transfers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        vehicleId: technician.vehicleId || 1,
        direction: "CENTRAL_TO_VEHICLE",
        items: [{ productName, quantity: 6, unit: "L" }],
        notes: "Carga inicial",
      }),
    });
    assert(transfer.response.ok && transfer.data.ok, `transfer failed: ${JSON.stringify(transfer.data)}`);

    const suggestions = await fetchJson(`${BASE_URL}/equipment-stock-os/visits/${visit.id}/suggestions`, { headers });
    assert(suggestions.response.ok && suggestions.data.ok, "visit suggestion failed");

    const consume = await fetchJson(`${BASE_URL}/equipment-stock-os/visits/${visit.id}/consume`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        vehicleId: technician.vehicleId || 1,
        items: [{ productName, quantity: 2, unit: "L" }],
      }),
    });
    assert(consume.response.ok && consume.data.ok, `consume failed: ${JSON.stringify(consume.data)}`);

    const alerts = await fetchJson(`${BASE_URL}/equipment-stock-os/stock/alerts`, { headers });
    assert(alerts.response.ok && alerts.data.ok, "stock alerts failed");

    const dashboard = await fetchJson(`${BASE_URL}/equipment-stock-os/dashboard`, { headers });
    assert(dashboard.response.ok && dashboard.data.ok, "dashboard failed");

    const customerReport = await fetchJson(`${BASE_URL}/equipment-stock-os/customer-report/${client.id}`, { headers });
    assert(customerReport.response.ok && customerReport.data.ok, "customer report failed");

    console.log(JSON.stringify({
      ok: true,
      service: "EquipmentStockOsOperationalSmoke",
      equipmentRows: inventory.data.equipment.length,
      movementRows: dashboard.data.dashboard.lastMovements.length,
      alertRows: alerts.data.alerts.length,
      consumedRows: consume.data.consumed.length,
    }, null, 2));
  } finally {
    if (created.visitId) await prisma.serviceVisit.deleteMany({ where: { id: created.visitId } }).catch(() => null);
    if (created.equipmentId) await prisma.poolEquipment.deleteMany({ where: { id: created.equipmentId } }).catch(() => null);
    if (created.poolId) await prisma.pool.deleteMany({ where: { id: created.poolId } }).catch(() => null);
    if (created.clientId) {
      await prisma.notification.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
      await prisma.client.deleteMany({ where: { id: created.clientId } }).catch(() => null);
    }
    if (created.technicianId) await prisma.technician.deleteMany({ where: { id: created.technicianId } }).catch(() => null);
    await prisma.stockMovement.deleteMany({ where: { createdBy: { in: ["TECHNICIAN_FIELD", "system"] }, notes: { contains: "Carga inicial" } } }).catch(() => null);
    await prisma.stockBalance.deleteMany({ where: { productName: "CLORO LIQUIDO QA" } }).catch(() => null);
    await prisma.inventoryProduct.deleteMany({ where: { name: "CLORO LIQUIDO QA" } }).catch(() => null);
    await prisma.technicalHistory.deleteMany({ where: { type: { in: ["EQUIPMENT_MAINTENANCE_SCHEDULED", "EQUIPMENT_STOCK_CONSUMPTION"] } } }).catch(() => null);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, service: "EquipmentStockOsOperationalSmoke", error: error.message }, null, 2));
  process.exit(1);
});

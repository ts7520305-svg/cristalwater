const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CUSTOMER_OS_BASE_URL || "http://127.0.0.1:3002/api";
const DOCUMENT_BASE_DIR = path.join(__dirname, "../uploads/documents");
const DOCUMENT_MANIFEST_PATH = path.join(DOCUMENT_BASE_DIR, "manifest.json");
const RUN_ID = `CUSTOMER-OS-${Date.now()}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.includes("application/json")) {
    throw new Error(`Non-JSON response from ${url} (status ${response.status}): ${text.slice(0, 200)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url} (status ${response.status}): ${text.slice(0, 200)}`);
  }
  return { response, data };
}

function appendManifestDocument(entry) {
  fs.mkdirSync(DOCUMENT_BASE_DIR, { recursive: true });
  const manifest = (() => {
    try {
      const raw = fs.readFileSync(DOCUMENT_MANIFEST_PATH, "utf8");
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();
  manifest.push(entry);
  fs.writeFileSync(DOCUMENT_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function removeManifestDocument(documentId) {
  try {
    const manifest = JSON.parse(fs.readFileSync(DOCUMENT_MANIFEST_PATH, "utf8"));
    const next = manifest.filter((row) => Number(row.id) !== Number(documentId));
    fs.writeFileSync(DOCUMENT_MANIFEST_PATH, JSON.stringify(next, null, 2));
  } catch {
    // ignore
  }
}

async function main() {
  const created = { clientId: null, poolId: null, visitId: null, notificationId: null, messageId: null, documentId: null, documentFilename: null };
  const email = `customer-os-${Date.now()}@example.com`;
  const password = "CustomerOs123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const client = await prisma.client.create({
      data: {
        name: `Customer OS ${RUN_ID}`,
        email,
        password: hashedPassword,
        active: true,
        status: "ACTIVE",
        contractActive: true,
        billingActive: true,
        paymentStatus: "PAID",
        creditBalance: 0,
      },
    });
    created.clientId = client.id;

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `Pool ${RUN_ID}`,
        active: true,
        zone: "QA",
        type: "POOL",
        latitude: 38.0,
        longitude: -9.0,
      },
    });
    created.poolId = pool.id;

    const visit = await prisma.serviceVisit.create({
      data: {
        clientId: client.id,
        poolId: pool.id,
        technicianName: "Smoke Technician",
        plannedDate: new Date(),
        date: new Date(),
        status: "PLANNED",
        notes: "Smoke test visit",
        products: JSON.stringify([{ name: "Cloro", quantity: 1, unit: "KG" }]),
        ph: 7.4,
        chlorine: 2,
        alkalinity: 95,
        salt: 3400,
        temperature: 26,
      },
    });
    created.visitId = visit.id;

    const docFilename = `customer-os-${RUN_ID}.txt`;
    const docPath = path.join(DOCUMENT_BASE_DIR, docFilename);
    fs.mkdirSync(DOCUMENT_BASE_DIR, { recursive: true });
    fs.writeFileSync(docPath, `Customer OS smoke document for client ${client.id}\n`);
    created.documentFilename = docFilename;

    const documentId = Date.now();
    created.documentId = documentId;
    appendManifestDocument({
      id: documentId,
      entity: "CLIENT",
      entityId: client.id,
      clientId: client.id,
      poolId: pool.id,
      visitId: visit.id,
      title: `Relatório Customer OS ${RUN_ID}`,
      type: "text/plain",
      originalName: docFilename,
      filename: docFilename,
      url: `/uploads/documents/${docFilename}`,
      notes: "Smoke document",
      createdAt: new Date().toISOString(),
    });

    const loginRes = await fetch(`${BASE_URL}/client-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && loginData.ok, `login failed: ${JSON.stringify(loginData)}`);
    const token = loginData.token;
    assert(token, "missing client token");

    const headers = { Authorization: `Bearer ${token}` };

    const { response: dashboardRes, data: dashboardData } = await fetchJson(`${BASE_URL}/client-portal/${client.id}/dashboard`, { headers });
    assert(dashboardRes.ok && dashboardData.ok, `dashboard failed: ${JSON.stringify(dashboardData)}`);
    assert(Array.isArray(dashboardData.dashboard.poolStatus) && dashboardData.dashboard.poolStatus.length === 1, "dashboard poolStatus missing");
    assert(dashboardData.dashboard.healthScore <= 100, "dashboard health score invalid");

    const { response: notificationsRes, data: notificationsData } = await fetchJson(`${BASE_URL}/client-portal/${client.id}/notifications`, { headers });
    assert(notificationsRes.ok && notificationsData.ok, `notifications failed: ${JSON.stringify(notificationsData)}`);

    const { response: documentsRes, data: documentsData } = await fetchJson(`${BASE_URL}/client-portal/${client.id}/documents`, { headers });
    assert(documentsRes.ok && documentsData.ok, `documents failed: ${JSON.stringify(documentsData)}`);
    assert(Array.isArray(documentsData.documents) && documentsData.documents.some((doc) => Number(doc.id) === documentId), "secure document missing from list");

    const documentDownloadRes = await fetch(`${BASE_URL}/client-portal/${client.id}/documents/${documentId}/download`, { headers });
    assert(documentDownloadRes.ok, `document download failed with status ${documentDownloadRes.status}`);

    const { response: permissionsRes, data: permissionsData } = await fetchJson(`${BASE_URL}/client-portal/${client.id}/permissions`, { headers });
    assert(permissionsRes.ok && permissionsData.ok, `permissions failed: ${JSON.stringify(permissionsData)}`);
    assert(permissionsData.permissions?.readOnly === true, "permissions readOnly missing");

    const { response: messageRes, data: messageData } = await fetchJson(`${BASE_URL}/client-portal/${client.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ text: "Smoke customer message" }),
    });
    assert(messageRes.ok && messageData.ok, `message post failed: ${JSON.stringify(messageData)}`);
    created.messageId = messageData.message?.id || null;

    const { response: requestRes, data: requestData } = await fetchJson(`${BASE_URL}/client-portal/${client.id}/visit-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ message: "Smoke visit request" }),
    });
    assert(requestRes.ok && requestData.ok, `visit request failed: ${JSON.stringify(requestData)}`);
    created.notificationId = requestData.notification?.id || null;

    const { response: historyRes, data: historyData } = await fetchJson(`${BASE_URL}/client-portal/history/${client.id}`, { headers });
    assert(historyRes.ok && historyData.ok, `history failed: ${JSON.stringify(historyData)}`);
    assert(Array.isArray(historyData.pools) && historyData.pools.length === 1, "grouped history missing");

    console.log(JSON.stringify({
      ok: true,
      service: "CustomerOsOperationalSmoke",
      clientId: client.id,
      dashboard: dashboardData.dashboard,
      notifications: notificationsData.notifications.length,
      documents: documentsData.documents.length,
      historyPools: historyData.pools.length,
    }, null, 2));
  } finally {
    if (created.clientId) {
      await prisma.clientMessage.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
      await prisma.notification.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
      await prisma.communicationLog.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
    } else {
      if (created.messageId) {
        await prisma.clientMessage.deleteMany({ where: { id: created.messageId } }).catch(() => null);
      }
      if (created.notificationId) {
        await prisma.notification.deleteMany({ where: { id: created.notificationId } }).catch(() => null);
      }
    }
    if (created.visitId) {
      await prisma.serviceVisit.deleteMany({ where: { id: created.visitId } }).catch(() => null);
    }
    if (created.poolId) {
      await prisma.pool.deleteMany({ where: { id: created.poolId } }).catch(() => null);
    }
    if (created.clientId) {
      await prisma.client.deleteMany({ where: { id: created.clientId } }).catch(() => null);
    }
    if (created.documentFilename) {
      try { fs.unlinkSync(path.join(DOCUMENT_BASE_DIR, created.documentFilename)); } catch {}
    }
    if (created.documentId) {
      removeManifestDocument(created.documentId);
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, service: "CustomerOsOperationalSmoke", error: error.message }, null, 2));
  process.exit(1);
});

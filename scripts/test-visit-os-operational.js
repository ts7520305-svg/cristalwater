const http = require("http");

const BASE = process.env.VISIT_OS_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";

function request(method, path, body = null, { parseJson = true } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;

    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString("utf8");
          const contentType = String(res.headers["content-type"] || "").toLowerCase();

          if (parseJson && contentType.includes("application/json")) {
            try {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                body: text ? JSON.parse(text) : null,
                rawLength: buffer.length,
              });
              return;
            } catch (error) {
              reject(error);
              return;
            }
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawLength: buffer.length,
            rawText: text,
          });
        });
      }
    );

    req.on("error", reject);

    if (data) req.write(data);
    req.end();
  });
}

function requestMultipart(method, path, { fields = {}, fileField = "photo", fileName = "visit-os-photo.txt", fileContent = "Visit OS photo" } = {}) {
  return new Promise((resolve, reject) => {
    const boundary = `----VisitOS${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
    const parts = [];

    for (const [key, value] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\n`));
      parts.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
      parts.push(Buffer.from(`${value}\r\n`));
    }

    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\n`));
    parts.push(Buffer.from(`Content-Type: text/plain\r\n\r\n`));
    parts.push(Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(String(fileContent)));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const payload = Buffer.concat(parts);

    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": payload.length,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: raw ? JSON.parse(raw) : null,
              rawText: raw,
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function assertStep(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const startedAt = Date.now();
  const suffix = uniqueSuffix();

  const user = await request("POST", "/api/users", {
    name: `Visit OS GPS ${suffix}`,
    email: `visit-os-gps-${suffix}@cristalwater.pt`,
    password: "VisitOs123!",
    role: "TECHNICIAN",
    active: true,
  });

  const client = await request("POST", "/api/clients", {
    name: `Visit OS Client ${suffix}`,
    email: `visit-os-client-${suffix}@cristalwater.pt`,
    phone: "910000000",
    address: "Rua Operacional 1",
    zone: "ZONA-OS",
  });

  const pool = await request("POST", "/api/pools", {
    clientId: client.body.client.id,
    name: `Visit OS Pool ${suffix}`,
    volumeM3: 45,
    location: "Operacional",
    address: "Rua Operacional 1",
    type: "RECTANGULAR",
    notes: "Fluxo operacional do Visit OS",
  });

  const equipment = await request("POST", "/api/pool-equipment", {
    poolId: pool.body.pool.id,
    type: "PUMP",
    brand: "Pentair",
    model: "Operational Smoke",
    notes: "Equipamento de teste do Visit OS",
  });

  const technician = await request("POST", "/api/technicians", {
    name: `Visit OS Technician ${suffix}`,
    email: `visit-os-tech-${suffix}@cristalwater.pt`,
    phone: "920000000",
    role: "TECHNICIAN",
    active: true,
  });

  const visitStart = await request("POST", "/api/visits/start", {
    poolId: pool.body.pool.id,
    technicianId: technician.body.id,
    technicianName: technician.body.name,
    plannedDate: new Date().toISOString(),
    startNow: true,
  });

  const visitId = visitStart.body?.visit?.id;
  assertStep(Number.isInteger(visitId) && visitId > 0, "Visita não foi criada corretamente.");

  const gps = await request("POST", "/api/gps/update", {
    userId: user.body.id,
    latitude: 38.7223,
    longitude: -9.1393,
    trackingMode: "ACTIVE",
    batteryLevel: 87,
    accuracyM: 6,
  });

  const observation = await request("POST", `/api/visits/${visitId}/observation`, {
    notes: `Observação operacional ${suffix}`,
    internalNotes: `Nota temporária operacional ${suffix}`,
  });

  const photoUpload = await requestMultipart("POST", `/api/visits/${visitId}/photo`, {
    fields: { type: "AFTER" },
    fileName: "visit-os-photo.txt",
    fileContent: `Visit OS photo ${suffix}`,
  });

  const incident = await request("POST", "/api/visits/incident", {
    visitId,
    message: `Incidente operacional ${suffix}`,
    type: "FIELD_PROBLEM",
    priority: "NORMAL",
  });

  const complete = await request("POST", `/api/core/visits/${visitId}/complete`, {
    ph: 7.4,
    chlorine: 1.5,
    alkalinity: 100,
    temperature: 26,
    salt: 1200,
    notes: "Visit OS operacional concluído",
    cleaned: true,
    brushed: true,
    vacuumed: true,
    basketCleaned: true,
    waterlineClean: true,
    technicianId: technician.body.id,
  });

  const visitDetail = await request("GET", `/api/visits/${visitId}`);
  const report = await request("GET", `/api/report-visit/visit/${visitId}?role=CLIENT`, null, { parseJson: false });
  const portal = await request("GET", `/api/client-portal/${client.body.client.id}`);
  const dashboard = await request("GET", "/api/dashboard/metrics");
  const history = await request("GET", `/api/technical-history/pool/${pool.body.pool.id}`);
  const technicianStatsById = await request("GET", `/api/technician-stats/${user.body.id}`);
  const technicianStats = technicianStatsById.status === 200
    ? technicianStatsById
    : await request("GET", "/api/technician-stats");
  const audit = await request("GET", "/api/security/audit?take=20");

  const elapsedMs = Date.now() - startedAt;

  const ok =
    user.status === 200 &&
    client.status === 201 &&
    pool.status === 201 &&
    equipment.status === 201 &&
    technician.status === 201 &&
    visitStart.status === 200 &&
    gps.status === 200 &&
    gps.body?.ok !== false &&
    observation.status === 200 &&
    observation.body?.ok === true &&
    photoUpload.status === 200 &&
    photoUpload.body?.ok === true &&
    incident.status === 200 &&
    incident.body?.ok === true &&
    complete.status === 200 &&
    complete.body?.ok === true &&
    visitDetail.status === 200 &&
    visitDetail.body?.ok === true &&
    visitDetail.body?.visit?.status === "DONE" &&
    report.status === 200 &&
    String(report.headers["content-type"] || "").includes("application/pdf") &&
    report.rawLength > 0 &&
    portal.status === 200 &&
    portal.body?.ok === true &&
    (
      (Array.isArray(portal.body?.poolTimeline) && portal.body.poolTimeline.length > 0) ||
      (Array.isArray(portal.body?.client?.pools) && portal.body.client.pools.length > 0) ||
      (Array.isArray(portal.body?.pools) && portal.body.pools.length > 0)
    ) &&
    dashboard.status === 200 &&
    dashboard.body?.ok === true &&
    history.status === 200 &&
    (Array.isArray(history.body) || Array.isArray(history.body?.history)) &&
    technicianStats.status === 200 &&
    (
      technicianStats.body?.stats?.completedServices >= 1 ||
      (Array.isArray(technicianStats.body) && technicianStats.body.length >= 1)
    ) &&
    audit.status === 200 &&
    audit.body?.ok === true &&
    Array.isArray(audit.body?.logs) &&
    elapsedMs < 180000;

  console.log(
    JSON.stringify(
      {
        ok,
        service: "VisitOsOperationalSmokeTest",
        elapsedMs,
        visitId,
        checkedAt: new Date().toISOString(),
        steps: {
          user: user.status,
          client: client.status,
          pool: pool.status,
          equipment: equipment.status,
          technician: technician.status,
          visitStart: visitStart.status,
          gps: gps.status,
          observation: observation.status,
          photoUpload: photoUpload.status,
          incident: incident.status,
          complete: complete.status,
          report: report.status,
          portal: portal.status,
          dashboard: dashboard.status,
          history: history.status,
          technicianStats: technicianStats.status,
          audit: audit.status,
        },
      },
      null,
      2
    )
  );

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
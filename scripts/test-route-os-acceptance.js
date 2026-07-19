const http = require("http");
const { prisma } = require("../src/prismaClient");

const BASE = process.env.ROUTE_OS_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";

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

function requestMultipart(method, path, { fields = {}, fileField = "photo", fileName = "route-os-photo.txt", fileContent = "Route OS photo" } = {}) {
  return new Promise((resolve, reject) => {
    const boundary = `----RouteOS${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
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

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function orderByOptimize(points, start) {
  const remaining = [...points];
  const ordered = [];
  let current = { ...start };

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    remaining.forEach((point, index) => {
      const d = distance(current.lat, current.lng, point.latitude, point.longitude);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });

    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    current = { lat: next.latitude, lng: next.longitude };
  }

  return ordered;
}

async function main() {
  const startedAt = Date.now();
  const suffix = uniqueSuffix();
  const pin = String(740000 + (Date.now() % 100000)).slice(-6);
  const today = new Date().toISOString();
  const now = new Date();
  const clientIds = [];
  const poolIds = [];
  const visitIds = [];
  const created = { pools: [], visits: [] };

  const user = await request("POST", "/api/users", {
    name: `Route OS Technician User ${suffix}`,
    email: `route-os-user-${suffix}@cristalwater.pt`,
    password: "RouteOs123!",
    role: "TECHNICIAN",
    active: true,
    pin,
  });

  const userId = Number(user.body?.id || user.body?.user?.id || 0);
  assertStep([200, 201].includes(user.status), "Falha ao criar utilizador do workday.");
  assertStep(Number.isInteger(userId) && userId > 0, "Utilizador criado sem ID valido.");

  const technician = await request("POST", "/api/technicians", {
    name: `Route OS Technician ${suffix}`,
    email: `route-os-tech-${suffix}@cristalwater.pt`,
    phone: "930000000",
    role: "TECHNICIAN",
    active: true,
    pin,
  });

  assertStep(technician.status === 201, "Falha ao criar tecnico.");
  assertStep(Number.isInteger(technician.body?.id), "Tecnico criado sem ID valido.");

  const login = await request("POST", "/api/technician-auth/login", { pin });
  assertStep(login.status === 200 && login.body?.ok === true, "Falha no login do tecnico por PIN.");
  assertStep(login.body?.token, "Login do tecnico nao devolveu token.");

  const workdayStart = await request("POST", "/api/workday/start", { userId });
  assertStep(workdayStart.status === 200 && workdayStart.body?.ok === true, "Falha ao iniciar o dia de trabalho.");

  const workdayStatus = await request("GET", `/api/workday/status/${userId}`);
  assertStep(workdayStatus.status === 200 && workdayStatus.body?.ok === true, "Falha ao consultar estado do workday.");
  assertStep(workdayStatus.body?.workDay?.status === "ACTIVE", "Workday nao ficou ACTIVE.");

  const baseLat = 63.4201;
  const baseLng = -18.1213;
  const poolSeeds = Array.from({ length: 5 }, (_, index) => ({
    lat: baseLat + (index * 0.0065),
    lng: baseLng + (index * 0.0065),
  }));

  for (let index = 0; index < 5; index += 1) {
    const client = await request("POST", "/api/clients", {
      name: `Route OS Client ${index + 1} ${suffix}`,
      email: `route-os-client-${index + 1}-${suffix}@cristalwater.pt`,
      phone: `91000000${index}`,
      address: `Route OS Street ${index + 1}`,
      zone: `ROUTE-OS-${index + 1}`,
    });

    assertStep(client.status === 201 && client.body?.client?.id, `Falha ao criar cliente ${index + 1}.`);
    clientIds.push(client.body.client.id);

    const pool = await request("POST", "/api/pools", {
      clientId: client.body.client.id,
      name: `Route OS Pool ${index + 1} ${suffix}`,
      volumeM3: 40 + index,
      location: `Route sector ${index + 1}`,
      address: `Route OS Street ${index + 1}`,
      type: "RECTANGULAR",
      latitude: poolSeeds[index].lat,
      longitude: poolSeeds[index].lng,
      notes: `Piscina operacional ${index + 1} para acceptance de Route OS`,
      technicalSheet: {
        volumeM3: 40 + index,
        disinfectionType: "CLORO",
        targetPhMin: 7.2,
        targetPhMax: 7.6,
        targetChlorineMin: 1.0,
        targetChlorineMax: 3.0,
        targetAlkalinityMin: 80,
        targetAlkalinityMax: 120,
        specialObservations: `Acceptance Route OS ${suffix}`,
      },
    });

    assertStep(pool.status === 201 && pool.body?.pool?.id, `Falha ao criar piscina ${index + 1}.`);
    poolIds.push(pool.body.pool.id);
    created.pools.push(pool.body.pool);

    const equipment = await request("POST", "/api/pool-equipment", {
      poolId: pool.body.pool.id,
      type: "PUMP",
      brand: "Pentair",
      model: `Route OS Pump ${index + 1}`,
      notes: `Equipamento de acceptance ${index + 1}`,
    });

    assertStep(equipment.status === 201 && equipment.body?.id, `Falha ao criar equipamento da piscina ${index + 1}.`);

    const visit = await request("POST", "/api/visits/start", {
      poolId: pool.body.pool.id,
      technicianId: technician.body.id,
      technicianName: technician.body.name,
      plannedDate: today,
      startNow: false,
    });

    assertStep(visit.status === 200 && visit.body?.visit?.id, `Falha ao criar visita ${index + 1}.`);
    visitIds.push(visit.body.visit.id);
    created.visits.push(visit.body.visit);
  }

  const routePreview = await request("GET", `/api/route/optimize?lat=${baseLat - 0.01}&lng=${baseLng - 0.01}`);
  assertStep(routePreview.status === 200, "Falha ao gerar preview de rota.");

  const optimizedRouteIds = Array.isArray(routePreview.body)
    ? routePreview.body.map((visit) => visit?.id).filter(Boolean)
    : [];
  const routeSubset = optimizedRouteIds.filter((id) => visitIds.includes(id));

  assertStep(routeSubset.length === 5, "A rota gerada nao incluiu as 5 visitas do acceptance.");

  const todayRound = await request("GET", `/api/technician/today?technicianId=${technician.body.id}`);
  assertStep(todayRound.status === 200 && todayRound.body?.ok === true, "Falha ao carregar a ronda do dia.");
  assertStep(Array.isArray(todayRound.body?.visits) && todayRound.body.visits.length >= 5, "Ronda do dia nao devolveu as 5 visitas.");

  const technicianVisitsToday = await request("GET", `/api/visits/today?technicianId=${technician.body.id}`);
  assertStep(technicianVisitsToday.status === 200 && technicianVisitsToday.body?.ok === true, "Falha ao listar visitas de hoje do tecnico.");
  assertStep(technicianVisitsToday.body?.total >= 5, "Lista de visitas de hoje nao tem pelo menos 5 registos.");

  for (let index = 0; index < visitIds.length; index += 1) {
    const visitId = visitIds[index];
    const clientId = clientIds[index];
    const poolId = poolIds[index];

    const detailBefore = await request("GET", `/api/visits/${visitId}`);
    assertStep(detailBefore.status === 200 && detailBefore.body?.ok === true, `Falha ao abrir a visita ${visitId}.`);
    assertStep(Boolean(detailBefore.body?.visit?.pool?.equipment), `Visita ${visitId} sem contexto de equipamento.`);

    const observation = await request("POST", `/api/visits/${visitId}/observation`, {
      notes: `Observacao Route OS ${index + 1} ${suffix}`,
      internalNotes: `Nota interna Route OS ${index + 1} ${suffix}`,
    });
    assertStep(observation.status === 200 && observation.body?.ok === true, `Falha ao registar observacao da visita ${visitId}.`);

    const photo = await requestMultipart("POST", `/api/visits/${visitId}/photo`, {
      fields: { type: "AFTER" },
      fileName: `route-os-${index + 1}.txt`,
      fileContent: `Route OS photo ${index + 1} ${suffix}`,
    });
    assertStep(photo.status === 200 && photo.body?.ok === true, `Falha ao carregar foto da visita ${visitId}.`);

    if (index === 0) {
      const incident = await request("POST", "/api/visits/incident", {
        visitId,
        message: `Incidente controlado Route OS ${suffix}`,
        type: "FIELD_PROBLEM",
        priority: "NORMAL",
      });
      assertStep(incident.status === 200 && incident.body?.ok === true, `Falha ao registar incidente na visita ${visitId}.`);
    }

    const complete = await request("POST", `/api/core/visits/${visitId}/complete`, {
      visitId,
      technicianId: technician.body.id,
      ph: 7.4,
      chlorine: 1.5,
      alkalinity: 100,
      temperature: 25.8,
      salt: 1200,
      notes: `Conclusao Route OS ${index + 1} ${suffix}`,
      cleaned: true,
      brushed: true,
      vacuumed: true,
      basketCleaned: true,
      waterlineClean: true,
    });
    assertStep(complete.status === 200 && complete.body?.ok === true, `Falha ao concluir a visita ${visitId}.`);

    const detailAfter = await request("GET", `/api/visits/${visitId}`);
    assertStep(detailAfter.status === 200 && detailAfter.body?.ok === true, `Falha ao reabrir a visita ${visitId}.`);
    assertStep(detailAfter.body?.visit?.status === "DONE", `Visita ${visitId} nao ficou DONE.`);

    const history = await request("GET", `/api/technical-history/pool/${poolId}`);
    assertStep(history.status === 200, `Falha ao consultar historico tecnico da piscina ${poolId}.`);
    assertStep(Array.isArray(history.body) && history.body.length >= 1, `Historico tecnico vazio para a piscina ${poolId}.`);
  }

  const notifications = await prisma.notification.findMany({
    where: {
      clientId: { in: clientIds },
      createdAt: { gte: new Date(startedAt) },
    },
    orderBy: { createdAt: "asc" },
  });

  const auditRows = await prisma.auditTrail.findMany({
    where: {
      visitId: { in: visitIds },
      eventType: "VISIT_COMPLETED",
    },
    orderBy: { createdAt: "asc" },
  });

  const historyRows = await prisma.technicalHistory.findMany({
    where: {
      poolId: { in: poolIds },
      createdAt: { gte: new Date(startedAt) },
    },
  });

  const dashboard = await request("GET", "/api/dashboard/metrics");
  const doneCount = Array.isArray(dashboard.body?.serviceVisitsByStatus)
    ? dashboard.body.serviceVisitsByStatus.find((row) => row.status === "DONE")?._count?.id || 0
    : 0;

  const notificationsApi = await request("GET", "/api/notifications");
  const customerNotifications = Array.isArray(notificationsApi.body?.notifications)
    ? notificationsApi.body.notifications.filter((notification) => clientIds.includes(notification.clientId))
    : [];

  const workdayStatusAfter = await request("GET", `/api/workday/status/${user.body.id}`);

  const elapsedMs = Date.now() - startedAt;
  const ok =
    user.status === 200 &&
    technician.status === 201 &&
    login.status === 200 &&
    workdayStart.status === 200 &&
    workdayStatus.status === 200 &&
    routePreview.status === 200 &&
    todayRound.status === 200 &&
    technicianVisitsToday.status === 200 &&
    dashboard.status === 200 &&
    doneCount >= 5 &&
    notifications.length >= 5 &&
    customerNotifications.length >= 5 &&
    historyRows.length >= 5 &&
    auditRows.length >= 5 &&
    workdayStatusAfter.status === 200 &&
    workdayStatusAfter.body?.workDay?.status === "ACTIVE" &&
    elapsedMs < 180000;

  console.log(
    JSON.stringify(
      {
        ok,
        service: "RouteOsAcceptanceTest",
        elapsedMs,
        checkedAt: new Date().toISOString(),
        counts: {
          clients: clientIds.length,
          pools: poolIds.length,
          visits: visitIds.length,
          notifications: notifications.length,
          customerNotifications: customerNotifications.length,
          technicalHistory: historyRows.length,
          auditTrail: auditRows.length,
          doneVisits: doneCount,
        },
        route: {
          expected: visitIds,
          optimizedSubset: routeSubset,
          optimizedAll: optimizedRouteIds.slice(0, 12),
        },
        workday: {
          before: workdayStatus.body?.workDay?.status || null,
          after: workdayStatusAfter.body?.workDay?.status || null,
        },
        steps: {
          user: user.status,
          technician: technician.status,
          login: login.status,
          workdayStart: workdayStart.status,
          routePreview: routePreview.status,
          todayRound: todayRound.status,
          visitsToday: technicianVisitsToday.status,
          dashboard: dashboard.status,
          notificationsApi: notificationsApi.status,
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

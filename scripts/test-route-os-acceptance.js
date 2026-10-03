const http = require("http");
require("../src/loadEnv")();
let authToken;
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
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

async function availablePin() {
  const pins = require('../src/services/technicianPinService');
  for(let attempt=0;attempt<20;attempt++) {
    const pin = String(require('node:crypto').randomInt(100000,1000000));
    if(!(await pins.findMatches(prisma,pin,{activeOnly:true,stopAfter:1})).length)return pin;
  }
  throw new Error('Unable to allocate a distinct Route OS QA PIN');
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
  const groupStarted=Date.now(),phaseTimings=[];let phaseStarted=groupStarted;
  const mark=phase=>{const now=Date.now();phaseTimings.push({phase,ms:now-phaseStarted});phaseStarted=now;};
  const adminLogin = await request("POST", "/api/auth/login", {email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD});
  if (adminLogin.status !== 200 || !adminLogin.body?.token) throw new Error(`Admin login failed: ${adminLogin.status}`);
  authToken = adminLogin.body.token;
  await testRoundAssignmentPeriods(adminLogin.body.user);
  mark('round assignments and native language matrix');
  await testVisitCoverage(adminLogin.body.user);
  mark('coverage journey');
  await testRecurrence(adminLogin.body.user);
  mark('recurrence journey');
  const startedAt = Date.now();
  const suffix = uniqueSuffix();
  const pin = await availablePin();
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

  const technician = await require("./helpers/create-reviewed-technician")(request, {
    name: `Route OS Technician ${suffix}`,
    email: `route-os-tech-${suffix}@cristalwater.pt`,
    phone: "930000000",
    pin,
  }, {response:true});

  assertStep(technician.status === 200, "Falha ao criar tecnico.");
  assertStep(Number.isInteger(technician.body?.id), "Tecnico criado sem ID valido.");

  const login = await request("POST", "/api/technician-auth/login", { pin });
  assertStep(login.status === 200 && login.body?.ok === true, "Falha no login do tecnico por PIN.");
  assertStep(login.body?.token, "Login do tecnico nao devolveu token.");

  const workdayStart = await request("POST", "/api/workday/start", { userId });
  assertStep([200, 201].includes(workdayStart.status) && workdayStart.body?.ok === true, "Falha ao iniciar o dia de trabalho.");

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
    technician.status === 200 &&
    login.status === 200 &&
    [200, 201].includes(workdayStart.status) &&
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

  mark('route workday and completion journey');console.log('QA Route OS phases '+JSON.stringify({totalMs:Date.now()-groupStarted,phases:phaseTimings}));
  process.exit(ok ? 0 : 1);
}

async function selectRoundLanguage(page,language){
  const assert=require('node:assert/strict');
  assert.equal(await page.locator('#cwLanguageSelect').count(),1,'Rounds forms need the existing global language selector');
  const saved=page.waitForResponse(response=>response.url().endsWith('/api/settings/language/me')&&response.request().method()==='PUT'&&response.request().postDataJSON().language===language);
  await page.locator('#cwLanguageSelect').selectOption(language);
  const response=await saved;assert.equal(response.status(),200);assert.deepEqual(await response.json(),{ok:true,language});
  await page.waitForFunction(value=>document.documentElement.lang===value,language);
}

async function checkRoundFormLanguages(page,round,pool,visits,summarySources){
  const languageStarted=Date.now(),languageTimings=[];let phaseStarted=languageStarted;
  const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
  const languages=['pt','en','fr','es','de'],headings=['Rondas','Rounds','Tournées','Rondas','Rundgänge'];
  const plannerUnassigned=['Sem tecnico','Unassigned','Sans technicien','Sin técnico','Nicht zugewiesen'],plannerNumber=['Tecnico #{id}','Technician #{id}','Technicien #{id}','Técnico #{id}','Techniker #{id}'],plannerDrop=['Arraste visitas para aqui','Drag visits here','Glissez les visites ici','Arrastra visitas aquí','Besuche hierher ziehen'];
  const chipKinds={SERVICE:['Ronda','Round','Tournée','Ronda','Rundgang'],EXTRA:['Extra','Extra','Supplément','Extra','Zusatz']};
  const assignmentCopy={NORMAL:['Normal','Normal','Normal','Normal','Normal'],SUPPORT:['Ajuda / apoio','Help / support','Aide / renfort','Ayuda / apoyo','Hilfe / Unterstützung'],SUBSTITUTION:['Substituicao','Substitution','Remplacement','Sustitución','Vertretung'],OTHER_DAY:['Ronda de outro dia','Round from another day','Tournée d’un autre jour','Ronda de otro día','Rundgang eines anderen Tages'],RESCHEDULE:['Reagendada','Rescheduled','Replanifiée','Reprogramada','Neu geplant'],UNASSIGNED:['Sem tecnico','Unassigned','Sans technicien','Sin técnico','Nicht zugewiesen']};
  const tableHeadings=[['Data','Date','Date','Fecha','Datum'],['Cliente','Client','Client','Cliente','Kunde'],['Piscina','Pool','Piscine','Piscina','Pool'],['Tecnico','Technician','Technicien','Técnico','Techniker'],['Tipo / cobranca','Type / billing','Type / facturation','Tipo / facturación','Typ / Abrechnung'],['Estado','Status','État','Estado','Status'],['Editar','Edit','Modifier','Editar','Bearbeiten']];
  const tableAria=['Lista editavel de visitas da semana','Editable weekly visits list','Liste modifiable des visites de la semaine','Lista editable de visitas de la semana','Bearbeitbare Liste der Wochenbesuche'],tableActionMeasurements=[];
  const badgeCopy={normal:['Ronda normal','Normal round','Tournée normale','Ronda normal','Normaler Rundgang'],alert:['Com alerta','With alert','Avec alerte','Con alerta','Mit Warnung']};let badgeCases=0,badgeGeometry=0;
  const now=new Date(),ago=days=>new Date(now.getTime()-days*86400000),tomorrow=new Date(now.getTime()+86400000);
  const coverageClient=await prisma.client.create({data:{name:'Rondas',active:true}}),coverageTechnician=await prisma.technician.create({data:{name:'Rondas',active:true}});
  const coveragePools=[];
  for(const name of ['Criar ronda <img src=x>','Agendada','Sem data'])coveragePools.push(await prisma.pool.create({data:{name,clientId:coverageClient.id,active:true,createdAt:ago(40),volumeM3:40,technicalSheet:{create:{volumeM3:40,disinfectionType:'CHLORINE'}}}}));
  const coverageVisits=[];
  for(const data of [{plannedDate:ago(1),technicianId:null,status:'PLANNED'},{plannedDate:null,technicianId:coverageTechnician.id,status:'PLANNED'},{plannedDate:now,technicianId:coverageTechnician.id,status:'IN_PROGRESS',startAt:now},{plannedDate:now,technicianId:coverageTechnician.id,status:'INCOMPLETE',startAt:ago(1)},{plannedDate:tomorrow,technicianId:coverageTechnician.id,status:'PLANNED'}])coverageVisits.push(await prisma.serviceVisit.create({data:{poolId:coveragePools[0].id,...data}}));
  coverageVisits.push(await prisma.serviceVisit.create({data:{poolId:coveragePools[1].id,technicianId:coverageTechnician.id,plannedDate:ago(20),startAt:ago(20),endAt:ago(20),status:'DONE',ph:7.3,internalNotes:'Rondas'}}));
  await prisma.roundPool.create({data:{roundId:round.id,poolId:coveragePools[2].id,order:2}});
  const refreshed=page.waitForResponse(response=>response.url().endsWith('/api/rounds/coverage')&&response.request().method()==='GET');await page.locator('#coverageRefresh').click();const coverageResponse=await refreshed;assert.equal(coverageResponse.status(),200);
  const coverageData=await coverageResponse.json();assert(coveragePools.every(pool=>coverageData.rows.some(row=>row.poolId===pool.id)),'All own native coverage cases are returned');
  await page.waitForFunction(ids=>ids.every(id=>document.querySelector(`[data-coverage-pool="${id}"]`)),coveragePools.map(pool=>pool.id));
  const coverageLabels={
    NO_ROUND:['Sem ronda ativa','No active round','Aucune tournée active','Sin ronda activa','Kein aktiver Rundgang'],
    STALE_COMPLETION:['Última manutenção precisa de revisão','Last maintenance needs review','Dernier entretien à vérifier','Último mantenimiento pendiente de revisión','Letzte Wartung prüfen'],
    NEVER_COMPLETED:['Sem manutenção concluída registada','No completed maintenance recorded','Aucun entretien terminé enregistré','Sin mantenimiento completado registrado','Keine abgeschlossene Wartung erfasst'],
    NOT_SCHEDULED_TODAY:['Ronda prevista hoje, sem visita gerada','Round scheduled today, no visit generated','Tournée prévue aujourd’hui, aucune visite générée','Ronda prevista hoy, sin visita generada','Rundgang heute geplant, kein Besuch erzeugt'],
    OVERDUE:['Em atraso','Overdue','En retard','Atrasada','Überfällig'],UNASSIGNED:['Sem técnico ativo','No active technician','Aucun technicien actif','Sin técnico activo','Kein aktiver Techniker'],
    NO_DATE:['Sem data','No date','Sans date','Sin fecha','Ohne Datum'],INCOMPLETE:['Por concluir','Incomplete','À terminer','Por completar','Unvollständig'],
  };
  const actualFlags=new Set(coverageData.rows.filter(row=>coveragePools.some(pool=>pool.id===row.poolId)).flatMap(row=>[...row.flags,...row.visits.flatMap(visit=>visit.issues)]));assert(Object.keys(coverageLabels).every(flag=>actualFlags.has(flag)),'Eight flag/issue codes need native own fixtures');
  const coverageExpected=index=>coverageData.rows.map(row=>({id:row.poolId,pool:row.poolName,client:row.clientName+' · ',completion:row.lastCompleted?['Última conclusão: ','Last completion: ','Dernière réalisation : ','Última finalización: ','Letzter Abschluss: '][index]+new Date(row.lastCompleted).toLocaleDateString('pt-PT'):['Sem conclusão registada','No completion recorded','Aucune réalisation enregistrée','Sin finalización registrada','Kein Abschluss erfasst'][index],flags:row.flags.map(flag=>coverageLabels[flag]?.[index]||'').join(' · '),visits:row.visits.map(visit=>({id:visit.id,line:['Visita','Visit','Visite','Visita','Besuch'][index]+' #'+visit.id+' · '+(visit.plannedDate?new Date(visit.plannedDate).toLocaleDateString('pt-PT'):coverageLabels.NO_DATE[index])+' · '+(visit.technicianName||['Por atribuir','Unassigned','À attribuer','Sin asignar','Nicht zugewiesen'][index]),issues:(visit.issues.map(flag=>coverageLabels[flag]?.[index]||'').join(' · ')||['Agendada','Scheduled','Planifiée','Programada','Geplant'][index])+(visit.canTransfer?'':' · '+['Acompanhamento individual necessário','Individual follow-up required','Suivi individuel nécessaire','Seguimiento individual necesario','Individuelle Betreuung erforderlich'][index]),aria:visit.canTransfer?['Selecionar visita ','Select visit ','Sélectionner la visite ','Seleccionar visita ','Besuch '][index]+visit.id+(index===4?' auswählen':''):null})),returnLabel:row.visits.some(visit=>visit.issues.includes('INCOMPLETE'))?['Combinar regresso','Arrange return visit','Organiser une nouvelle visite','Coordinar regreso','Rückbesuch vereinbaren'][index]:null,plan:row.flags.includes('NOT_SCHEDULED_TODAY')?['Verifique as rondas abaixo e utilize Gerar semana após confirmar o planeamento.','Check the rounds below and generate weekly visits after confirming the plan.','Vérifiez les tournées ci-dessous et générez les visites de la semaine après confirmation du planning.','Comprueba las rondas siguientes y genera las visitas semanales tras confirmar el plan.','Die Rundgänge unten prüfen und nach Bestätigung der Planung Wochenbesuche erzeugen.'][index]:null}));
  const coverageView=()=>page.locator('#coverageList').evaluate(root=>[...root.querySelectorAll('.coverage-pool')].map(card=>({id:Number(card.dataset.coveragePool),pool:card.querySelector('h3').textContent,client:card.children[1].firstChild.nodeValue,completion:card.querySelector('[data-coverage-copy="completion"]').textContent,flags:card.querySelector('[data-coverage-copy="flags"]').textContent,visits:[...card.querySelectorAll('.coverage-visit')].map(label=>({id:Number(label.dataset.coverageVisit),line:label.querySelector('[data-coverage-copy="visit"]').textContent,issues:label.querySelector('[data-coverage-copy="issues"]').textContent,aria:label.querySelector('[data-transfer-visit]')?.getAttribute('aria-label')||null})),returnLabel:card.querySelector('a[href="/admin-alerts#incompleteFollowups"]')?.textContent||null,plan:card.lastElementChild.tagName==='P'&&card.lastElementChild!==card.children[2]?card.lastElementChild.textContent:null})));
  const expected=[
    ['#createRoundBtn',['Criar ronda','Create round','Créer une tournée','Crear ronda','Rundgang erstellen']],
    ['label[for="roundName"]',['Nome da ronda','Round name','Nom de la tournée','Nombre de la ronda','Name des Rundgangs']],
    ['label[for="roundRecurrence"]',['Frequência','Frequency','Fréquence','Frecuencia','Häufigkeit']],
    ['#roundRecurrence option[value="WEEKLY"],#extraRepeatMode option[value="weekly"]',['Semanal','Weekly','Hebdomadaire','Semanal','Wöchentlich']],
    ['#roundRecurrence option[value="DAILY"]',['Diária — todos os dias','Daily - every day','Quotidienne - tous les jours','Diaria - todos los días','Täglich - jeden Tag']],
    ['#roundRecurrence option[value="MONTHLY"]',['Mensal','Monthly','Mensuelle','Mensual','Monatlich']],
    ['label[for="roundDay"],label[for="visitDayFilter"]',['Dia da semana','Day of week','Jour de la semaine','Día de la semana','Wochentag']],
    ['label[for="roundMonthDay"]',['Dia do mês (1–31)','Day of month (1–31)','Jour du mois (1–31)','Día del mes (1–31)','Tag des Monats (1–31)']],
    ['label[for="roundStartsOn"]',['Início (opcional)','Start (optional)','Début (facultatif)','Inicio (opcional)','Beginn (optional)']],
    ['label[for="roundEndsOn"]',['Fim (opcional)','End (optional)','Fin (facultative)','Fin (opcional)','Ende (optional)']],
    ['label[for="assignTechRound"],label[for="assignPoolRound"],label[for="visitRoundFilter"]',['Ronda','Round','Tournée','Ronda','Rundgang']],
    ['label[for="assignTech"],label[for="extraTechnician"],label[for="visitTechnicianFilter"]',['Tecnico','Technician','Technicien','Técnico','Techniker']],
    ['label[for="assignmentPeriod"]',['Validade','Validity','Validité','Validez','Gültigkeit']],
    ['#assignmentPeriod option[value="RANGE"]',['De data X a data Y','From date X to date Y','De la date X à la date Y','De la fecha X a la fecha Y','Von Datum X bis Datum Y']],
    ['#assignmentPeriod option[value="DAY"]',['Um dia','One day','Un jour','Un día','Ein Tag']],
    ['#assignmentPeriod option[value="WEEK"]',['Uma semana (7 dias)','One week (7 days)','Une semaine (7 jours)','Una semana (7 días)','Eine Woche (7 Tage)']],
    ['#assignmentPeriod option[value="MONTH"]',['Um mês','One month','Un mois','Un mes','Ein Monat']],
    ['#assignmentPeriod option[value="PERMANENT"]',['Sempre, desde a data de início','Always, from the start date','Toujours, à partir de la date de début','Siempre, desde la fecha de inicio','Unbefristet ab dem Anfangsdatum']],
    ['label[for="assignmentStart"]',['Data de início','Start date','Date de début','Fecha de inicio','Anfangsdatum']],
    ['label[for="assignmentEnd"]',['Último dia incluído','Last day included','Dernier jour inclus','Último día incluido','Letzter eingeschlossener Tag']],
    ['label[for="assignmentReason"]',['Motivo da atribuição','Assignment reason','Motif de l’affectation','Motivo de asignación','Grund der Zuweisung']],
    ['#assignTechBtn',['Rever e atribuir ronda','Review and assign round','Vérifier et attribuer la tournée','Revisar y asignar ronda','Rundgang prüfen und zuweisen']],
    ['#assignPoolBtn',['Atribuir piscina','Assign pool','Attribuer une piscine','Asignar piscina','Pool zuweisen']],
    ['label[for="assignPool"],label[for="extraPool"]',['Piscina','Pool','Piscine','Piscina','Pool']],
    ['label[for="assignPoolOrder"]',['Ordem','Order','Ordre','Orden','Reihenfolge']],
    ['label[for="extraStart"]',['Data e hora','Date and time','Date et heure','Fecha y hora','Datum und Uhrzeit']],
    ['label[for="extraRepeatCount"]',['Quantidade','Quantity','Quantité','Cantidad','Anzahl']],
    ['label[for="extraRepeatMode"]',['Repeticao','Repetition','Répétition','Repetición','Wiederholung']],
    ['#extraRepeatMode option[value="once"]',['Uma vez','Once','Une fois','Una vez','Einmal']],
    ['#extraRepeatMode option[value="daily"]',['Todos os dias','Every day','Tous les jours','Todos los días','Jeden Tag']],
    ['#visitDayFilter option[value=""]',['Todos os dias','All days','Tous les jours','Todos los días','Alle Tage']],
    ['label[for="extraBillingMode"]',['Faturacao','Billing','Facturation','Facturación','Abrechnung']],
    ['#extraBillingMode option[value="EXTRA"]',['Extra cobravel','Chargeable extra','Supplément facturable','Extra facturable','Kostenpflichtiger Zusatz']],
    ['#extraBillingMode option[value="INCLUDED"]',['Incluida no contrato','Included in contract','Incluse dans le contrat','Incluida en el contrato','Im Vertrag enthalten']],
    ['#extraBillingMode option[value="NO_CHARGE"]',['Sem cobranca','No charge','Sans facturation','Sin cobro','Kostenfrei']],
    ['label[for="extraPrice"]',['Valor por visita extra','Price per extra visit','Prix par visite supplémentaire','Precio por visita extra','Preis je Zusatzbesuch']],
    ['label[for="extraNotes"]',['Notas internas','Internal notes','Notes internes','Notas internas','Interne Notizen']],
    ['#createExtraVisitBtn',['Criar visita extra','Create extra visit','Créer une visite supplémentaire','Crear visita extra','Zusatzbesuch erstellen']],
    ['#generateWeekBtn',['Gerar visitas da semana','Generate weekly visits','Générer les visites de la semaine','Generar visitas de la semana','Wochenbesuche erzeugen']],
    ['#forceGenerateBtn',['Verificar visitas em falta','Check missing visits','Vérifier les visites manquantes','Comprobar visitas faltantes','Fehlende Besuche prüfen']],
    ['label[for="visitSearch"]',['Pesquisa','Search','Recherche','Búsqueda','Suche']],
    ['label[for="visitDateFilter"]',['Dia','Day','Jour','Día','Tag']],
    ['label[for="visitWeekFilter"]',['Semana','Week','Semaine','Semana','Woche']],
    ['label[for="visitStatusFilter"]',['Estado','Status','État','Estado','Status']],
    ['#visitStatusFilter option[value=""]',['Todos os estados','All statuses','Tous les états','Todos los estados','Alle Status']],
    ['#visitStatusFilter option[value="alerts"]',['Com alertas','With alerts','Avec alertes','Con alertas','Mit Alarmen']],
    ['#visitStatusFilter option[value="late"]',['Atrasadas','Overdue','En retard','Atrasadas','Überfällig']],
    ['#visitStatusFilter option[value="pending"]',['Pendentes / em curso','Pending / in progress','En attente / en cours','Pendientes / en curso','Ausstehend / in Bearbeitung']],
    ['#visitStatusFilter option[value="done"]',['Concluidas','Completed','Terminées','Completadas','Abgeschlossen']],
    ['#visitStatusFilter option[value="extra"]',['Visitas extra','Extra visits','Visites supplémentaires','Visitas extra','Zusatzbesuche']],
    ['#visitStatusFilter option[value="billable"]',['Extras cobraveis','Chargeable extras','Suppléments facturables','Extras facturables','Kostenpflichtige Zusätze']],
    ['#clearVisitFilters',['Limpar filtros','Clear filters','Effacer les filtres','Limpiar filtros','Filter zurücksetzen']],
    ['#coverageRefresh',['Verificar agora','Check now','Vérifier maintenant','Comprobar ahora','Jetzt prüfen']],
    ['#coverageTransfer label:nth-of-type(1)',['Novo técnico','New technician','Nouveau technicien','Nuevo técnico','Neuer Techniker']],
    ['#coverageTransfer label:nth-of-type(2)',['Motivo da redistribuição','Reassignment reason','Motif de réaffectation','Motivo de redistribución','Grund der Neuverteilung']],
    ['#coverageTransfer label:nth-of-type(3)',['Informação para a gestão','Information for management','Informations pour la gestion','Información para la gestión','Informationen für die Verwaltung']],
    ['#coverageTechnician option[value=""]',['Selecionar técnico','Select technician','Sélectionner un technicien','Seleccionar técnico','Techniker auswählen']],
    ['#coverageTransfer button',['Pré-visualizar transferência','Preview transfer','Prévisualiser le transfert','Previsualizar transferencia','Übertragung prüfen']],
    ['#coverageCause option:nth-child(1)',['Ausência de técnico','Technician absence','Absence du technicien','Ausencia de técnico','Abwesenheit des Technikers']],
    ['#coverageCause option:nth-child(2)',['Avaria de viatura','Vehicle breakdown','Panne de véhicule','Avería del vehículo','Fahrzeugausfall']],
    ['#coverageCause option:nth-child(3)',['Falta de produtos químicos','Missing chemicals','Manque de produits chimiques','Falta de productos químicos','Fehlende Chemikalien']],
    ['#coverageCause option:nth-child(4)',['Falta de material ou equipamento','Missing materials or equipment','Manque de matériel ou d’équipement','Falta de material o equipo','Fehlendes Material oder Gerät']],
    ['#coverageCause option:nth-child(5)',['Apoio à rota','Route support','Renfort de tournée','Apoyo a la ruta','Routenunterstützung']],
    ['#visitTechnicianFilter option[value=""]',['Todos os tecnicos','All technicians','Tous les techniciens','Todos los técnicos','Alle Techniker']],
    ['#visitRoundFilter option[value=""]',['Todas as rondas','All rounds','Toutes les tournées','Todas las rondas','Alle Rundgänge']],
    ['#extraTechnician option[value=""]',['Sem tecnico definido','No technician assigned','Aucun technicien attribué','Sin técnico asignado','Kein Techniker zugewiesen']],
    ['#extraPool option[value=""]',['Piscina / jacuzzi da visita extra','Pool / hot tub for extra visit','Piscine / jacuzzi de la visite supplémentaire','Piscina / jacuzzi de la visita extra','Pool / Whirlpool für den Zusatzbesuch']],
  ];
  const weekdays=[['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'],['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']];
  const attributes=[
    ['#roundName','placeholder',['Nome da ronda','Round name','Nom de la tournée','Nombre de la ronda','Name des Rundgangs']],
    ['#assignPoolOrder','placeholder',['Ordem','Order','Ordre','Orden','Reihenfolge']],
    ['#extraRepeatCount','placeholder',['Quantas visitas','How many visits','Nombre de visites','Cuántas visitas','Anzahl der Besuche']],
    ['#extraPrice','placeholder',['Valor por visita extra','Price per extra visit','Prix par visite supplémentaire','Precio por visita extra','Preis je Zusatzbesuch']],
    ['#visitDateFilter','title',['Filtrar por dia','Filter by day','Filtrer par jour','Filtrar por día','Nach Tag filtern']],
    ['#visitWeekFilter','title',['Filtrar por semana','Filter by week','Filtrer par semaine','Filtrar por semana','Nach Woche filtern']],
  ];
  const sql=async()=>JSON.stringify({round:await prisma.round.findUnique({where:{id:round.id},include:{technicians:true,pools:true,assignments:true}}),warningRound:await prisma.round.findUnique({where:{id:summarySources.warningRound.id},include:{technicians:true,pools:true,assignments:true}}),roundCount:await prisma.round.count(),visits:await prisma.serviceVisit.findMany({where:{OR:[{id:{in:visits.map(visit=>visit.id)}},{poolId:{in:[pool.id,...coveragePools.map(pool=>pool.id)]}}]},orderBy:{id:'asc'}}),client:await prisma.client.findUnique({where:{id:coverageClient.id}}),technician:await prisma.technician.findUnique({where:{id:coverageTechnician.id}}),pools:await prisma.pool.findMany({where:{id:{in:coveragePools.map(pool=>pool.id)}},orderBy:{id:'asc'}}),writes:await prisma.fieldWriteRequest.count(),stock:await prisma.stockMovement.count(),receipts:await prisma.operationalReminder.count()});
  await page.locator('#visitSearch').fill(pool.name);
  const ownPoolVisits=await prisma.serviceVisit.findMany({where:{poolId:pool.id},select:{id:true}}),filteredIds=await page.locator('#weekVisits tbody tr[data-kind="SERVICE"]').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.id)));
  assert(ownPoolVisits.some(visit=>filteredIds.includes(visit.id)),'Real UI filter must keep an own generated visit without pruning SQL data');
  const summaryCounts=await page.evaluate(()=>{const all=allPlannerVisits(),rows=filterVisits(all);return{visible:rows.length,total:all.length,alerts:rows.filter(visitHasAlert).length,late:rows.filter(visitIsLate).length,extras:rows.filter(row=>row.kind==='EXTRA').length,billable:rows.filter(row=>row.kind==='EXTRA'&&row.billingMode==='EXTRA').length};});
  const filteredRows=await page.locator('#weekVisits tbody tr').evaluateAll(nodes=>nodes.map(node=>[node.dataset.kind,Number(node.dataset.id)]));
  assert.equal(summaryCounts.visible,filteredRows.length,'The native filtered table contains the captured visit count');
  assert(Array.isArray(summarySources.week));assert(Array.isArray(summarySources.extras));
  const summaryBounds=await page.evaluate(()=>{const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+7);return{start:start.getTime(),end:end.getTime()};});
  assert.equal(summaryCounts.total,summarySources.week.length+summarySources.extras.filter(row=>{const date=new Date(row.scheduledAt||row.date||row.plannedDate).getTime();return date>=summaryBounds.start&&date<summaryBounds.end;}).length,'The captured total agrees with both actual page API responses');
  const sourceIds=new Set([...summarySources.week.map(row=>'SERVICE-'+row.id),...summarySources.extras.map(row=>'EXTRA-'+row.id)]);assert(filteredRows.every(([kind,id])=>sourceIds.has(kind+'-'+id)),'Every filtered row exists in its native source');
  const summaryCopy=['{visible} de {total} visita(s) - {alerts} alerta(s) - {late} atrasada(s) - {extras} extra(s) - {billable} cobravel(is)','{visible} of {total} visit(s) - {alerts} alert(s) - {late} overdue - {extras} extra(s) - {billable} chargeable','{visible} sur {total} visite(s) - {alerts} alerte(s) - {late} en retard - {extras} supplémentaire(s) - {billable} facturable(s)','{visible} de {total} visita(s) - {alerts} alerta(s) - {late} atrasada(s) - {extras} extra(s) - {billable} facturable(s)','{visible} von {total} Besuch(en) - {alerts} Alarm(e) - {late} überfällig - {extras} zusätzlich - {billable} kostenpflichtig'];
  const before=await sql(),requests=[];
  const plannerSql=async()=>JSON.stringify({rows:await prisma.technician.findMany({where:{id:{in:[summarySources.emptyTechnician.id,summarySources.literalTechnician.id]}},orderBy:{id:'asc'}}),count:await prisma.technician.count(),extra:await prisma.extraVisit.findUnique({where:{id:summarySources.plannerExtra.id}}),extraCount:await prisma.extraVisit.count(),modes:await prisma.serviceVisit.findMany({where:{id:{in:summarySources.modeFixtures.map(row=>row.id)}},orderBy:{id:'asc'}})});const plannerBefore=await plannerSql();
  assert(summarySources.modeFixtures.every(fixture=>summarySources.week.some(row=>row.id===fixture.id&&row.reason===fixture.reason&&row.notes===fixture.notes&&row.technicianId===fixture.technicianId)),'All six own assignment fixtures come from the actual authenticated page GET');
  assert.deepEqual(await page.evaluate(ids=>state.visits.filter(row=>ids.includes(row.id)).map(row=>({id:row.id,code:normalizeServiceVisit(row).assignmentMode})),summarySources.modeFixtures.map(row=>row.id)),summarySources.modeFixtures.map(({id,code})=>({id,code})),'Native normalization retains all six internal assignment codes');
  const warningEntries=await page.evaluate(()=>state.rounds.filter(round=>round.active!==false&&!roundHasTechnician(round)).map(round=>({id:round.id,name:String(round.name),day:Number(round.dayOfWeek)||0})));
  assert(warningEntries.some(round=>round.id===summarySources.warningRound.id&&round.name===summarySources.warningRound.name));
  const warningIds=new Set(warningEntries.map(round=>round.id));assert.deepEqual(warningEntries,summarySources.rounds.filter(round=>warningIds.has(round.id)).map(round=>({id:round.id,name:String(round.name),day:Number(round.dayOfWeek)||0})),'All warning entries agree with the actual page API');
  const warningCopy=['Aviso: {count} ronda(s) sem tecnico atribuido','Warning: {count} round(s) without an assigned technician','Attention : {count} tournée(s) sans technicien attribué','Aviso: {count} ronda(s) sin técnico asignado','Warnung: {count} Rundgang/Rundgänge ohne zugewiesenen Techniker'],warningAction=['. Associa um tecnico antes de gerar ou executar visitas.','. Assign a technician before generating or carrying out visits.','. Attribuez un technicien avant de générer ou effectuer des visites.','. Asigna un técnico antes de generar o realizar visitas.','. Vor dem Erzeugen oder Ausführen von Besuchen einen Techniker zuweisen.'];
  assert(Array.isArray(summarySources.technicians));assert(summarySources.technicians.some(tech=>tech.id===summarySources.emptyTechnician.id&&tech.name===''));assert(summarySources.technicians.some(tech=>tech.id===summarySources.literalTechnician.id&&tech.name==='Sem tecnico'));
  const plannerExpected=index=>[{id:'',label:plannerUnassigned[index]+' '},...summarySources.technicians.filter(tech=>tech.active!==false).map(tech=>({id:String(tech.id),label:(tech.name||plannerNumber[index].replace('{id}',String(tech.id)))+' '}))];
  assert(summarySources.extras.some(row=>row.id===summarySources.plannerExtra.id&&row.notes===summarySources.plannerExtra.notes));
  const listen=request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push({method:request.method(),path:new URL(request.url()).pathname});};
  await page.locator('#roundName').fill('Criar ronda <img src=x>');await page.locator('#extraNotes').fill('Rondas / Atualizar <b>draft literal</b>');
  await page.locator('#extraPool').selectOption(String(pool.id));await page.locator('#coverageCause').selectOption('Falta de produtos químicos');
  await page.locator(`[data-transfer-visit="${coverageVisits[0].id}"]`).check();
  await page.evaluate(()=>{
    document.getElementById('extraPrice').disabled=true;document.getElementById('createExtraVisitBtn').setAttribute('aria-busy','true');
    window.qaRoundNodes=[...document.querySelectorAll('main :is(input,textarea,select,option,button,h1,h2,h3,label),#coverageList :is(article,p,a,span),#coverageStatus,#visitFilterSummary,#status,#roundTechWarning,#roundTechWarning >*,#visitPlanner,#visitPlanner *,#weekVisits,#weekVisits .table-scroll,#weekVisits table,#weekVisits thead,#weekVisits thead *,#weekVisits tbody .ds-badge')].filter(node=>node.id!=='cwLanguageSelect'&&!node.closest('.cw-lang-switch')).map(node=>({node,children:[...node.childNodes]}));
    const visits=new Map(allPlannerVisits().map(visit=>[visit.uid,visit]));window.qaRoundChipSegments=[...document.querySelectorAll('#visitPlanner .visit-chip')].map(node=>{const visit=visits.get(node.dataset.kind+'-'+node.dataset.id),date=getVisitDate(visit);return{kind:node.dataset.kind,id:node.dataset.id,prefix:date?date.toLocaleString('pt-PT'):'Sem data',mode:visit.assignmentMode};});
    window.qaRoundBadgeParts=[...document.querySelectorAll('#weekVisits tbody tr')].flatMap(row=>{const visit=visits.get(row.dataset.kind+'-'+row.dataset.id);if(!visit)throw new Error('Missing native visit for table badges');const base={kind:row.dataset.kind,id:row.dataset.id};return[...(visit.kind==='SERVICE'?[{...base,key:'normal',class:'ds-badge is-muted'}]:[]),...(visitHasAlert(visit)?[{...base,key:'alert',class:'ds-badge is-danger'}]:[])];});
    window.qaRoundPlannerMarkup=()=>{
      const clone=document.getElementById('visitPlanner').cloneNode(true),fallbackIds=new Set(state.technicians.filter(tech=>tech.active!==false&&!tech.name).map(tech=>String(tech.id)));
      for(const column of clone.querySelectorAll('.tech-column'))if(column.dataset.technicianId===''||fallbackIds.has(column.dataset.technicianId))column.querySelector('h4').firstChild.nodeValue='QA_OWN_PLANNER_HEADING';
      for(const hint of clone.querySelectorAll('.tech-drop > .empty'))hint.firstChild.nodeValue='QA_OWN_PLANNER_HINT';
      for(const chip of clone.querySelectorAll('.visit-chip')){const parts=qaRoundChipSegments.find(row=>row.kind===chip.dataset.kind&&row.id===chip.dataset.id),leaf=chip.children[2].firstChild;leaf.nodeValue=leaf.nodeValue.slice(0,parts.prefix.length+3)+'QA_OWN_PLANNER_KIND - QA_OWN_PLANNER_ASSIGNMENT';}
      return clone.innerHTML;
    };
    window.qaRoundWeekMarkup=()=>{const clone=document.getElementById('weekVisits').cloneNode(true);for(const node of clone.querySelectorAll('thead th'))node.firstChild.nodeValue='QA_OWN_TABLE_HEADING';for(const node of clone.querySelectorAll('tbody tr .ds-badge.is-muted,tbody tr .ds-badge.is-danger'))node.firstChild.nodeValue='QA_OWN_TABLE_BADGE';clone.querySelector('.table-scroll').setAttribute('aria-label','QA_OWN_TABLE_ARIA');return clone.innerHTML;};
    window.qaRoundLiteral=[...document.querySelectorAll('#weekVisits,#visitPlanner,#visitReceiptsAdmin')].map(node=>({node,markup:node.id==='visitPlanner'?qaRoundPlannerMarkup():node.id==='weekVisits'?qaRoundWeekMarkup():node.innerHTML}));
  });
  const fingerprint=()=>page.evaluate(()=>JSON.stringify({controls:[...document.querySelectorAll('main input,main textarea,main select')].filter(node=>node.id!=='cwLanguageSelect').map(node=>({id:node.id,value:node.value,checked:node.checked,disabled:node.disabled,hidden:node.hidden,options:node.options?[...node.options].map(option=>({value:option.value,selected:option.selected,disabled:option.disabled})):null})),busy:document.getElementById('createExtraVisitBtn').getAttribute('aria-busy'),links:[...document.querySelectorAll('main a')].map(node=>node.getAttribute('href'))}));
  const controls=await fingerprint(),output=path.join(__dirname,'../reports/field-visual/round-coverage-languages');await fs.mkdir(output,{recursive:true});
  page.on('request',listen);let textCases=0,geometryCases=0;
  const preparationMs=Date.now()-phaseStarted;
  try{
    for(const [index,language] of languages.entries()){
      phaseStarted=Date.now();let tableMs=0;
      await selectRoundLanguage(page,language);
      const switchMs=Date.now()-phaseStarted;phaseStarted=Date.now();
      if(language==='en'){
        const ownCheckbox=page.locator(`[data-coverage-pool="${pool.id}"] [data-transfer-visit]`).first();
        assert.equal(await ownCheckbox.count(),1,'Native own coverage visit must be present');
        assert.equal(await ownCheckbox.getAttribute('aria-label'),'Select visit '+await ownCheckbox.getAttribute('data-transfer-visit'),'Own coverage checkbox must follow the selected language');
      }
      assert.equal(await page.locator('main h1').textContent(),headings[index]);assert.equal(await page.title(),'Cristal Water LDA - '+headings[index]);
      assert.deepEqual(await coverageView(),coverageExpected(index),language+' native coverage labels and literal data');
      assert.equal(await page.locator('#visitFilterSummary').textContent(),summaryCopy[index].replace(/\{(visible|total|alerts|late|extras|billable)\}/g,(_,key)=>summaryCounts[key]),language+' retains the six native filter totals');
      assert.equal(await page.locator('#status').textContent(),['Rondas e visitas carregadas com sucesso.','Rounds and visits loaded successfully.','Tournées et visites chargées avec succès.','Rondas y visitas cargadas correctamente.','Rundgänge und Besuche erfolgreich geladen.'][index],language+' native read-only load-all ready');
      assert.equal(await page.locator('#roundTechWarning strong').textContent(),warningCopy[index].replace('{count}',String(warningEntries.length)),language+' native warning count');
      assert.equal(await page.locator('#roundTechWarning span').textContent(),warningEntries.map(({day,name})=>`${weekdays[index][day]??String(weekdays[0][day])} - ${name}`).join(', ')+warningAction[index],language+' retains all API names and owns only weekdays/instruction');
      assert.equal(await page.locator('#kpiUnassignedRounds').textContent(),String(warningEntries.length));assert.equal(await page.locator('#roundTechWarning img').count(),0);
      const planner=await page.locator('#visitPlanner .tech-column').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.technicianId,label:node.querySelector('h4').firstChild.nodeValue,count:Number(node.querySelector('h4 span').textContent),chips:node.querySelectorAll('.visit-chip').length,hint:node.querySelector('.tech-drop > .empty')?.textContent??null})));
      assert.deepEqual(planner.map(({id,label})=>({id,label})),plannerExpected(index),language+' planner owns only unassigned/fallback copy, never public names');assert(planner.every(column=>column.count===column.chips&&(column.hint===null||column.hint===plannerDrop[index])));
      const chipParts=await page.evaluate(()=>qaRoundChipSegments),chipView=await page.locator('#visitPlanner .visit-chip').evaluateAll(nodes=>nodes.map(node=>({kind:node.dataset.kind,id:node.dataset.id,metadata:node.children[2].textContent})));
      assert(chipParts.some(chip=>chip.kind==='SERVICE'));assert(chipParts.some(chip=>chip.kind==='EXTRA'&&chip.id===String(summarySources.plannerExtra.id)));assert.deepEqual(chipView,chipParts.map(({kind,id,prefix,mode})=>({kind,id,metadata:prefix+' - '+chipKinds[kind][index]+' - '+assignmentCopy[mode][index]})),language+' owns chip copy only; dates and internal assignment codes stay exact');
      assert.deepEqual(chipParts.filter(row=>summarySources.modeFixtures.some(fixture=>row.kind==='SERVICE'&&row.id===String(fixture.id))).map(row=>row.mode).sort(),Object.keys(assignmentCopy).sort(),language+' retains all six own native modes in the real planner filter');
      const tableView=await page.locator('#weekVisits').evaluate(root=>({headings:[...root.querySelectorAll('thead th')].map(node=>node.textContent),aria:root.querySelector('.table-scroll').getAttribute('aria-label'),badges:[...root.querySelectorAll('tbody tr')].flatMap(row=>[...row.querySelectorAll('.ds-badge')].map(node=>({kind:row.dataset.kind,id:row.dataset.id,class:node.className,text:node.textContent}))),parts:qaRoundBadgeParts}));
      const {badges,parts,...tableHead}=tableView;assert.deepEqual(tableHead,{headings:tableHeadings.map(labels=>labels[index]),aria:tableAria[index]},language+' native editable table headings and accessible label');assert.deepEqual(badges,parts.map(({key,...part})=>({...part,text:badgeCopy[key][index]})),language+' native read-only badge copy retains kinds, IDs, classes and predicates');badgeCases++;
      assert.equal(await page.locator('#coverageStatus').textContent(),coverageData.rows.length+[' piscina(s) a verificar.',' pool(s) to review.',' piscine(s) à vérifier.',' piscina(s) por revisar.',' Pool(s) zu prüfen.'][index]+' '+coverageData.scope+' '+(coverageData.automaticAlertsEnabled?['Avisos ao escritório verificados automaticamente de hora a hora.','Office alerts checked automatically once an hour.','Alertes au bureau vérifiées automatiquement toutes les heures.','Avisos a la oficina revisados automáticamente cada hora.','Bürohinweise werden automatisch stündlich geprüft.'][index]:['Avisos automáticos desativados neste ambiente; utilize Verificar agora.','Automatic alerts disabled in this environment; use Check now.','Alertes automatiques désactivées dans cet environnement ; utilisez Vérifier maintenant.','Avisos automáticos desactivados en este entorno; utiliza Comprobar ahora.','Automatische Hinweise sind in dieser Umgebung deaktiviert; Jetzt prüfen verwenden.'][index]),language+' native read-only coverage ready');
      assert.equal(await page.locator(`[data-coverage-pool="${coveragePools[0].id}"] img`).count(),0);
      for(const [selector,labels] of expected){const actual=await page.locator(selector).evaluateAll(nodes=>nodes.map(node=>[...node.childNodes].find(child=>child.nodeType===Node.TEXT_NODE&&child.nodeValue.trim())?.nodeValue.trim()));assert(actual.length>0,selector);assert(actual.every(value=>value===labels[index]),language+' '+selector+' '+JSON.stringify(actual));textCases+=actual.length;}
      for(let day=0;day<7;day++)assert.deepEqual(await page.locator(`#roundDay option[value="${day}"],#visitDayFilter option[value="${day}"]`).allTextContents(),[weekdays[index][day],weekdays[index][day]]);
      for(const [selector,attribute,labels] of attributes)assert.equal(await page.locator(selector).getAttribute(attribute),labels[index]);
      for(const selector of ['#assignTechRound','#assignPoolRound'])assert.equal(await page.locator(selector+` option[value="${round.id}"]`).textContent(),weekdays[index][round.dayOfWeek]+' - '+round.name);
      assert.equal(await page.locator(`#extraPool option[value="${pool.id}"]`).textContent(),pool.name+' - Cliente geração QA');
      assert.equal(await fingerprint(),controls);assert(await page.evaluate(()=>qaRoundNodes.every(({node,children})=>node.isConnected&&node.childNodes.length===children.length&&children.every((child,i)=>node.childNodes[i]===child))));
      assert.deepEqual(await page.evaluate(()=>qaRoundLiteral.map(({node,markup})=>({node,markup,after:node.id==='visitPlanner'?qaRoundPlannerMarkup():node.id==='weekVisits'?qaRoundWeekMarkup():node.innerHTML})).filter(({markup,after})=>after!==markup).map(({node,markup,after})=>{let index=0;while(index<markup.length&&markup[index]===after[index])index++;return {id:node.id,index,before:markup.slice(Math.max(0,index-60),index+180),after:after.slice(Math.max(0,index-60),index+180)};})),[],'All non-owned planner/table markup and deferred operational producers remain literal');
      const stateMs=Date.now()-phaseStarted;phaseStarted=Date.now();
      for(const width of [320,390,1440]){
        await page.setViewportSize({width,height:1000});await page.locator('#roundName').scrollIntoViewIfNeeded();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),language+'/'+width+' page overflow');
        const geometry=await page.locator('.cols2>.card:first-child :is(h2,label,button),#coverageTransfer :is(label,button),.visit-filter-panel :is(input,select,button)').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{const box=node.getBoundingClientRect();return {text:node.firstChild?.textContent,width:box.width,left:box.left,right:box.right,viewport:innerWidth};}));
        assert(geometry.every(box=>box.left>=-1&&box.right<=box.viewport+1),language+'/'+width+' '+JSON.stringify(geometry));
        assert(await page.locator('#clearVisitFilters').evaluate(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].every(line=>line.left>=box.left&&line.right<=box.right)&&node.scrollWidth<=node.clientWidth;}),'Clear filter label fits '+language+'/'+width);
        assert(await page.locator('#roundTechWarning').evaluate(node=>{const box=node.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&[...node.querySelectorAll('strong,span')].every(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);});}),'Warning label fits '+language+'/'+width);
        assert(await page.locator(`#visitPlanner [data-technician-id="${summarySources.emptyTechnician.id}"]`).evaluate(node=>{const box=node.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&[...node.querySelectorAll('h4,.empty')].every(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);});}),'Planner fallback and empty hint fit '+language+'/'+width);
        assert(await page.locator(`#visitPlanner .visit-chip[data-kind="EXTRA"][data-id="${summarySources.plannerExtra.id}"]`).evaluate(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.children[2]);return box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);}),'Native extra metadata fits '+language+'/'+width);
        assert(await page.evaluate(ids=>ids.every(id=>{const node=document.querySelector(`#visitPlanner .visit-chip[data-kind="SERVICE"][data-id="${id}"]`),box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.children[2]);return box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1&&line.top>=box.top-1&&line.bottom<=box.bottom+1);}),summarySources.modeFixtures.map(row=>row.id)),'All six native assignment suffixes fit '+language+'/'+width);
        const tableStarted=Date.now(),tableMeasured=await page.locator('#weekVisits').evaluate(root=>{
          const scroll=root.querySelector('.table-scroll'),saved=scroll.scrollLeft,actions=[];
          const bounds=node=>{const box=node.getBoundingClientRect();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth};};
          try{
            let badgesFit=false;
            const headingsFit=[...root.querySelectorAll('thead th')].every((node,index)=>{scroll.scrollLeft+=node.getBoundingClientRect().left-scroll.getBoundingClientRect().left;const box=node.getBoundingClientRect(),frame=scroll.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);
              if(index===4)badgesFit=[...root.querySelectorAll('tbody tr .ds-badge')].every(badge=>{const box=badge.getBoundingClientRect(),cell=badge.closest('td').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(badge);return badge.scrollWidth<=badge.clientWidth+1&&[...range.getClientRects()].every(line=>[box,cell,frame].every(container=>line.left>=container.left-1&&line.right<=container.right+1)&&line.top>=box.top-1&&line.bottom<=box.bottom+1);});
              return frame.left>=0&&frame.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=frame.left-1&&line.right<=frame.right+1&&line.left>=box.left-1&&line.right<=box.right+1&&line.top>=box.top-1&&line.bottom<=box.bottom+1);});
            for(const position of ['maxScroll','columnAligned']){
              scroll.scrollLeft=scroll.scrollWidth;
              if(position==='columnAligned')scroll.scrollLeft+=root.querySelector('thead th:last-child').getBoundingClientRect().left-scroll.getBoundingClientRect().left;
              for(const node of root.querySelectorAll('[data-save-visit]')){
                const row=node.closest('tr'),box=bounds(node),group=bounds(node.closest('.table-actions')),cell=bounds(node.closest('td')),table=bounds(node.closest('table')),frame=bounds(scroll),style=getComputedStyle(node),range=document.createRange();range.selectNodeContents(node);
                const lines=[...range.getClientRects()].map(line=>({left:line.left,right:line.right,top:line.top,bottom:line.bottom})),inside=container=>lines.length>0&&lines.every(line=>line.left>=container.left-1&&line.right<=container.right+1&&line.top>=container.top-1&&line.bottom<=container.bottom+1);
                const tableStyle=getComputedStyle(node.closest('table'));
                actions.push({position,kind:row.dataset.kind,id:row.dataset.id,text:node.textContent,scrollLeft:scroll.scrollLeft,maxScroll:scroll.scrollWidth-scroll.clientWidth,box,group,cell,table,frame,lines,tableStyle:{display:tableStyle.display,width:tableStyle.width,maxWidth:tableStyle.maxWidth,overflowX:tableStyle.overflowX,tableLayout:tableStyle.tableLayout},style:{display:style.display,whiteSpace:style.whiteSpace,overflowX:style.overflowX,overflowY:style.overflowY,padding:style.padding,margin:style.margin},internalFits:inside(box)&&inside(group)&&inside(cell)&&node.scrollWidth<=node.clientWidth+1,visibleFits:frame.left>=0&&frame.right<=innerWidth+1&&lines.every(line=>line.left>=frame.left-1&&line.right<=frame.right+1)});
              }
            }
            // Keep every native box in the browser; transport failures and aggregates only.
            (window.qaRoundActionMeasurements??=[]).push(...actions);
            return{headingsFit,badgesFit,rowCount:root.querySelectorAll('tbody tr').length,actions:{count:actions.length,kinds:[...new Set(actions.map(row=>row.kind))],failures:actions.filter(row=>!row.internalFits||!row.visibleFits||row.tableStyle.overflowX!=='visible'||row.text!=='Guardar alteracoes'),sample:actions[0]}};
          }finally{scroll.scrollLeft=saved;}
        });
        assert(tableMeasured.headingsFit,'Seven native table headings fit horizontal scroll '+language+'/'+width);
        assert(tableMeasured.badgesFit,'Read-only badges fit their native billing column '+language+'/'+width);badgeGeometry++;
        tableActionMeasurements.push({language,width,...tableMeasured.actions});assert(tableMeasured.actions.count>0);assert.equal(tableMeasured.actions.count,tableMeasured.rowCount*2,'Measure both positions of every native editable row');assert.deepEqual(tableMeasured.actions.failures,[],'Every native save action fits internally and its horizontally scrolled column '+language+'/'+width);
        tableMs+=Date.now()-tableStarted;
        await page.locator(`[data-coverage-pool="${coveragePools[0].id}"]`).scrollIntoViewIfNeeded();
        assert(await page.locator('#coverageList [data-coverage-copy]').evaluateAll(nodes=>nodes.every(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);})),language+'/'+width+' coverage text fits');
        await page.screenshot({path:path.join(output,language+'-'+width+'.png'),caret:'initial'});geometryCases++;
      }
      languageTimings.push({language,switchMs,stateMs,geometryMs:Date.now()-phaseStarted,tableMs});
    }
    phaseStarted=Date.now();
    const saved=page.waitForResponse(response=>response.url().endsWith('/api/settings/language/me')&&response.request().method()==='PUT'&&response.request().postDataJSON().language==='fr');
    await page.locator('#extraNotes').evaluate(node=>{node.focus();node.setSelectionRange(3,9);CristalI18n.applyLanguage('fr');});assert.equal((await saved).status(),200);
    assert.deepEqual(await page.locator('#extraNotes').evaluate(node=>({focus:document.activeElement===node,start:node.selectionStart,end:node.selectionEnd})),{focus:true,start:3,end:9});assert.equal(await fingerprint(),controls);
    // Foreign leaves, cloned nodes and changed attributes must not acquire ownership.
    await page.evaluate(()=>{
      const heading=document.querySelector('main h1');heading.replaceChildren(document.createTextNode('Rondas'));
      const button=document.getElementById('createRoundBtn'),clone=button.cloneNode(true);clone.id='qaRoundClone';button.after(clone);button.firstChild.nodeValue='Criar ronda';
      const literal=document.createElement('p');literal.textContent='Rondas';literal.id='qaRoundLiteral';heading.after(literal);
      document.getElementById('roundName').setAttribute('placeholder','Nome da ronda');
      window.qaRoundForeign=[heading,button,clone,literal].map(node=>({node,markup:node.outerHTML}));
    });
    await page.evaluate(id=>{
      const card=document.querySelector(`[data-coverage-pool="${id}"]`),flags=card.querySelector('[data-coverage-copy="flags"]'),clone=flags.cloneNode(true);clone.id='qaCoverageClone';flags.after(clone);flags.replaceChildren(document.createTextNode('Sem ronda ativa'));
      const checkbox=card.querySelector('[data-transfer-visit]');checkbox.setAttribute('aria-label','Selecionar visita');window.qaCoverageForeign=[flags,clone].map(node=>({node,markup:node.outerHTML}));window.qaCoverageCheckbox=checkbox;
    },coveragePools[0].id);
    await page.evaluate(()=>{const root=document.getElementById('weekVisits'),node=root.querySelector('thead th'),clone=node.cloneNode(true),scroll=root.querySelector('.table-scroll'),cloneScroll=scroll.cloneNode(false);node.after(clone);scroll.after(cloneScroll);node.replaceChildren(document.createTextNode(node.textContent));scroll.setAttribute('aria-label','Lista editavel de visitas da semana');window.qaRoundTableForeign=[node,clone,cloneScroll].map(node=>({node,markup:node.outerHTML}));window.qaRoundTableAria=scroll;});
    await page.evaluate(ids=>{for(const [index,id]of ids.entries()){const node=document.querySelector(`#weekVisits tr[data-kind="SERVICE"][data-id="${id}"] .ds-badge.is-muted`);if(!node)throw new Error('Missing own native normal badge for ownership');const clone=node.cloneNode(true);node.after(clone);if(index)node.replaceChildren(document.createTextNode(node.textContent));else node.firstChild.nodeValue='Ronda normal';qaRoundTableForeign.push({node,markup:node.outerHTML},{node:clone,markup:clone.outerHTML});}},summarySources.modeFixtures.slice(0,2).map(row=>row.id));
    for(const language of languages){await selectRoundLanguage(page,language);assert(await page.evaluate(()=>qaRoundForeign.every(({node,markup})=>node.outerHTML===markup)&&qaCoverageForeign.every(({node,markup})=>node.outerHTML===markup)&&qaCoverageCheckbox.getAttribute('aria-label')==='Selecionar visita'));assert(await page.evaluate(()=>qaRoundTableForeign.every(({node,markup})=>node.outerHTML===markup)&&qaRoundTableAria.getAttribute('aria-label')==='Lista editavel de visitas da semana'),'Same-byte foreign table leaf/clones and changed aria never acquire ownership');assert.equal(await page.locator('#roundName').getAttribute('placeholder'),'Nome da ronda');assert.equal(await fingerprint(),controls);}
    await selectRoundLanguage(page,'pt');
    assert.deepEqual(requests.filter(request=>request.method==='GET'),[],'Changing language must not reload operational data');
    assert.deepEqual(requests.filter(request=>request.method!=='PUT'||request.path!=='/api/settings/language/me'),[],'Only the existing language preference may be written');
    assert.equal(await sql(),before,'Language changes must preserve exact native SQL rows and write/stock/receipt counts');
    assert.equal(await plannerSql(),plannerBefore,'Planner technician SQL rows and total count remain exact');
    assert.equal(badgeCases,5);assert.equal(badgeGeometry,15);
    const proof={ok:true,languages,widths:[320,390,1440],textCases,geometryCases,coverageFlags:[...actualFlags].sort(),coverageRows:coverageData.rows.length,ownCoveragePools:coveragePools.map(pool=>pool.id),coverageReadOnlyReady:true,mainReadOnlyReady:true,unassignedWarning:{count:warningEntries.length,ownRound:summarySources.warningRound.id,languageCases:5,geometryCases:15,capturedApiNames:true},filterSummary:{counts:summaryCounts,languageCases:5,actualPageApiSources:true},realAdminPage:true,successPayloadMocks:false,nodeIdentity:true,optionValues:true,drafts:true,focusAndCaret:true,foreignOwnership:true,zeroOperationalReads:true,zeroBusinessWrites:true,sqlUnchanged:true,deferred:['planner rows','main write and validation feedback','coverage transfer feedback','receipts','dialogs','empty option fallbacks']};
    proof.planner={languageCases:5,geometryCases:15,nativeTechnicians:summarySources.technicians.length,emptyTechnician:summarySources.emptyTechnician.id,literalTechnician:summarySources.literalTechnician.id,actualPageApiSources:true,allNonOwnedMarkupCompared:true};
    proof.planner.chipKinds={languageCases:5,extraGeometryCases:15,kinds:['SERVICE','EXTRA'],ownExtra:summarySources.plannerExtra.id,datesRemainLiteral:true,assignmentCodesUnchanged:true,allNonOwnedMarkupCompared:true};proof.planner.assignments={languageCases:5,geometryCases:15,codes:summarySources.modeFixtures.map(row=>row.code),fixtures:summarySources.modeFixtures.map(row=>row.id),nativeSourceRows:summarySources.week.length,allOriginalCyclesRetained:true,dateKindAndNonOwnedMarkupRetained:true};proof.planner.table={languageCases:5,geometryCases:15,foreignCases:5,headings:7,accessibleLabel:true,allNonOwnedMarkupCompared:true,editableRowsUnchanged:true,saveActions:{measurements:tableActionMeasurements.reduce((sum,row)=>sum+row.count,0),positions:['maxScroll','columnAligned'],kinds:[...new Set(tableActionMeasurements.flatMap(row=>row.kinds))],allInternalAndVisible:tableActionMeasurements.every(row=>!row.failures.length),allNativeBoxesRetained:true,transportCycles:tableActionMeasurements.length,neverClicked:true}};proof.deferred[0]='planner chip date fallback; table rows/options';
    proof.planner.table.badges={languageCases:badgeCases,geometryCases:badgeGeometry,foreignCases:5,foreignKind:'normal SERVICE',classesAndPredicatesRetained:true,allNonOwnedMarkupCompared:true};
    console.log('QA native rounds matrix phases '+JSON.stringify({totalMs:Date.now()-languageStarted,preparationMs,languages:languageTimings,foreignAndFinalMs:Date.now()-phaseStarted}));
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log('PASS rounds form languages '+JSON.stringify(proof));
  }finally{page.off('request',listen);}
}

async function reportOptionalAssets(page,label){
  const resources=await page.evaluate(base=>performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).origin!==base).map(entry=>{const url=new URL(entry.name);return{origin:url.origin,path:url.pathname,ms:entry.duration};}),new URL(BASE).origin);
  console.log('QA Route OS optional assets '+JSON.stringify({page:label,resources}));
}

async function openRoundsWithFilter(page,search){
  const assert=require('node:assert/strict');let release;const gate=new Promise(resolve=>{release=resolve;});
  const pattern='**/api/round-planner/week',hold=async route=>{const response=await route.fetch();assert.equal(response.status(),200);await gate;await route.fulfill({response});};
  await page.route(pattern,hold);
  try{
    const navigation=page.goto(BASE+'/admin-rounds',{waitUntil:'networkidle'});navigation.catch(()=>{});
    try{
      await page.waitForFunction(()=>Boolean(document.getElementById('assignmentStart')?.value),null,{timeout:7000});
      await page.locator('#visitSearch').fill(search);assert.equal(await page.locator('#visitSearch').inputValue(),search);
    }finally{release();}
    await navigation;
  }finally{release();await page.unroute(pattern,hold);}
}

async function testRoundAssignmentPeriods(adminUser){
  const assert=require('node:assert/strict');
  const business=require('../src/business/admin/RoundAssignmentBusiness');
  const a=await prisma.technician.create({data:{name:'Ronda habitual QA',active:true}}),b=await prisma.technician.create({data:{name:'Substituição QA',active:true}});
  const round=await prisma.round.create({data:{name:'Atribuição por datas QA',dayOfWeek:new Date().getDay(),technicians:{create:{technicianId:a.id}}}});
  const base=`/api/rounds/${round.id}/technicians`;
  const payload={technicianId:b.id,period:'RANGE',startsOn:'2032-12-28',endsOn:'2033-01-03',reason:'Férias entre anos'};
  const planned=await prisma.serviceVisit.create({data:{roundId:round.id,technicianId:a.id,plannedDate:new Date('2033-01-03T08:00:00'),status:'PLANNED'}});
  const started=await prisma.serviceVisit.create({data:{roundId:round.id,technicianId:a.id,plannedDate:new Date('2033-01-02T08:00:00'),status:'PLANNED',startAt:new Date()}});
  const after=await prisma.serviceVisit.create({data:{roundId:round.id,technicianId:a.id,plannedDate:new Date('2033-01-04T08:00:00'),status:'PLANNED'}});
  const preview=await request('POST',base,{...payload,preview:true});assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.eligible,1);assert.equal(preview.body.preserved,1);assert.equal(await prisma.roundAssignment.count({where:{roundId:round.id}}),0);
  const saved=await request('POST',base,payload);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.updated,1);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:planned.id}})).technicianId,b.id);
  assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${planned.id}:`}}}),1);
  assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${started.id}:`}}}),0);
  for(const visit of [started,after])assert.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).technicianId,a.id);
  const withBase=await prisma.round.findUnique({where:{id:round.id},include:{technicians:{include:{technician:true}}}});
  assert.equal((await business.resolveTechnician(prisma,withBase,new Date('2033-01-03T23:59:59'))).id,b.id);
  assert.equal((await business.resolveTechnician(prisma,withBase,new Date('2033-01-04T00:00:00'))).id,a.id);
  assert.equal((await request('POST',base,{...payload,endsOn:'2032-12-20'})).status,400);
  assert.equal((await request('POST',base,{...payload,startsOn:'2032-02-31'})).status,400);
  for(const [period,end] of [['DAY','2032-02-01'],['WEEK','2032-02-07'],['MONTH','2032-02-29']]){
    const dates=business.interval({period,startsOn:'2032-01-31'});assert.equal(dates.endsBefore.getFullYear(),Number(end.slice(0,4)));assert.equal(dates.endsBefore.getMonth()+1,Number(end.slice(5,7)));assert.equal(dates.endsBefore.getDate(),Number(end.slice(8,10)));
  }
  const permanent=await request('POST',base,{...payload,period:'PERMANENT',startsOn:'2033-02-01'});assert.equal(permanent.status,200);assert.equal(permanent.body.assignment.endsBefore,null);
  assert.equal((await business.resolveTechnician(prisma,withBase,new Date('2040-01-01T08:00:00'))).id,b.id);
  const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const client=await prisma.client.create({data:{name:'Cliente geração QA',active:true}});
  const pool=await prisma.pool.create({data:{name:'Piscina geração QA',clientId:client.id,volumeM3:40,active:true,technicalSheet:{create:{volumeM3:40,disinfectionType:'CHLORINE'}}}});
  await prisma.roundPool.create({data:{roundId:round.id,poolId:pool.id,order:1}});
  assert.equal((await request('POST',base,{...payload,period:'DAY',startsOn:date})).status,200);
  const generated=await Promise.all([request('POST','/api/round-planner/generate',{}),request('POST','/api/round-planner/generate',{})]);generated.forEach(reply=>assert.equal(reply.status,200,JSON.stringify(reply.body)));
  const visits=await prisma.serviceVisit.findMany({where:{poolId:pool.id}});assert.equal(visits.length,1);assert.equal(visits[0].technicianId,b.id);
  assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${visits[0].id}:`}}}),1);
  await prisma.serviceVisit.update({where:{id:visits[0].id},data:{internalNotes:'Nota preservada QA',ph:7.3}});
  const forced=await request('POST','/api/round-planner/generate',{force:true});assert.equal(forced.status,200);
  const retained=await prisma.serviceVisit.findUnique({where:{id:visits[0].id}});assert.equal(retained.internalNotes,'Nota preservada QA');assert.equal(retained.ph,7.3);
  assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${retained.id}:`}}}),1);
  const next=new Date(now);next.setDate(next.getDate()+14);next.setHours(8,0,0,0);
  const fallback=await Promise.all([business.generateVisit(null,{pool},next),business.generateVisit(null,{pool},next)]);assert.equal(fallback.filter(Boolean).length,1);
  await prisma.client.update({where:{id:client.id},data:{archiveStatus:'PAUSA'}});next.setDate(next.getDate()+1);assert.equal(await business.generateVisit(null,{pool},next),null);
  await prisma.client.update({where:{id:client.id},data:{archiveStatus:'ATIVO'}});
  await prisma.technician.update({where:{id:a.id},data:{active:false}});next.setDate(next.getDate()+1);
  while(next.getDay()!==round.dayOfWeek)next.setDate(next.getDate()+1);
  const unassigned=await business.generateVisit(withBase,{pool},next);assert.equal(unassigned.technicianId,null);assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${unassigned.id}:`}}}),0);
  await prisma.technician.update({where:{id:a.id},data:{active:true}});

  const plan=await request('GET',`/api/rounds/week?date=${date}`);assert.equal(plan.status,200);assert(plan.body.plan.days.some(day=>day.rounds.some(item=>item.id===round.id&&item.technicians[0]?.id===b.id)));
  const warningRound=await prisma.round.create({data:{name:'Aviso: <img src=x> $& {count} '+uniqueSuffix(),dayOfWeek:2,active:true}});
  const plannerSuffix=uniqueSuffix(),emptyTechnician=await prisma.technician.create({data:{name:'',active:true,notes:plannerSuffix+'-planner fallback only'}}),literalTechnician=await prisma.technician.create({data:{name:'Sem tecnico',active:true,notes:plannerSuffix+'-planner literal only'}});
  const plannerExtra=await prisma.extraVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:b.id,scheduledAt:new Date(),status:'PLANNED',billingMode:'EXTRA',isBillable:true,price:20,notes:plannerSuffix+'-Extra Ronda <img src=x> $&'}});
  const modeFixtures=[];
  for(const [code,reason]of [['NORMAL','Normal'],['SUPPORT','apoio'],['SUBSTITUTION','substituicao'],['OTHER_DAY','outro dia'],['RESCHEDULE','reagendada'],['UNASSIGNED','sem tecnico']])modeFixtures.push({code,...await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:code==='UNASSIGNED'?null:b.id,date:new Date(),plannedDate:new Date(),status:'PLANNED',reason,notes:plannerSuffix+'-'+code+' <img src=x> $&'}})});
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    await context.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({...user,role:'ADMIN'}));},{token:authToken,user:adminUser||{}});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const weekRead=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/round-planner/week'),extrasRead=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/extra-visits'),roundsRead=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/rounds'),techniciansRead=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/technicians');
    await openRoundsWithFilter(page,pool.name);
    await reportOptionalAssets(page,'round assignments');
    const weekReply=await weekRead,extrasReply=await extrasRead;assert.equal(weekReply.status(),200);assert.equal(extrasReply.status(),200);
    const roundsReply=await roundsRead;assert.equal(roundsReply.status(),200);const roundsPayload=await roundsReply.json();assert.equal(roundsPayload.ok,true);assert(Array.isArray(roundsPayload.rounds));
    const techniciansReply=await techniciansRead;assert.equal(techniciansReply.status(),200);
    const summarySources={week:await weekReply.json(),extras:(await extrasReply.json()).extraVisits,rounds:roundsPayload.rounds,warningRound,technicians:await techniciansReply.json(),emptyTechnician,literalTechnician,plannerExtra,modeFixtures};
    await selectRoundLanguage(page,'pt');
    await page.locator('#assignTechRound').selectOption(String(round.id));await page.locator('#assignTech').selectOption(String(b.id));
    await page.locator('#assignmentPeriod').selectOption('PERMANENT');assert(await page.locator('#assignmentEndField').isHidden());
    await page.locator('#assignmentStart').fill('2034-01-01');await page.locator('#assignmentReason').fill('Mudança permanente QA');
    const before=await prisma.roundAssignment.count({where:{roundId:round.id}});
    await page.locator('#assignTechBtn').click();
    await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('dialog').textContent(),/sem fim/);
    await page.getByRole('dialog').getByRole('button',{name:/Cancelar/i}).click();
    assert.equal(await prisma.roundAssignment.count({where:{roundId:round.id}}),before);
    assert.deepEqual(errors,[]);
    await checkRoundFormLanguages(page,round,pool,[planned,started,after],summarySources);
    assert.deepEqual(errors,[]);
    await context.close();
  }finally{await browser.close();}
  // Remove this template from later acceptance fixtures; preserve its history and assignments.
  await prisma.round.update({where:{id:round.id},data:{active:false}});
  await prisma.round.update({where:{id:warningRound.id},data:{active:false}});
  await prisma.technician.delete({where:{id:emptyTechnician.id}});await prisma.technician.delete({where:{id:literalTechnician.id}});
  await prisma.extraVisit.delete({where:{id:plannerExtra.id}});
  for(const fixture of modeFixtures)await prisma.serviceVisit.delete({where:{id:fixture.id}});
  console.log('PASS round date ranges include final day, cross years, expire to base, preserve started visits and generate once with assigned technician');
}

async function testVisitCoverage(adminUser){
  const assert=require('node:assert/strict'),uuid=()=>require('node:crypto').randomUUID();
  const old=new Date();old.setDate(old.getDate()-20);const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const a=await prisma.technician.create({data:{name:'Cobertura origem QA',active:true,pin:await availablePin()}}),b=await prisma.technician.create({data:{name:'Cobertura destino QA',active:true}});
  const client=await prisma.client.create({data:{name:'Cliente cobertura QA',active:true}});
  const pool=await prisma.pool.create({data:{name:'Piscina cobertura QA',clientId:client.id,createdAt:old}});
  const done=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:a.id,status:'DONE',endAt:old}});
  const pending=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:a.id,status:'PLANNED',plannedDate:yesterday}});
  const started=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:a.id,status:'IN_PROGRESS',plannedDate:new Date(),startAt:new Date()}});
  const round=await prisma.round.create({data:{name:'Cobertura hoje QA',active:true,dayOfWeek:new Date().getDay()}});
  const missing=await prisma.pool.create({data:{name:'Piscina sem geração QA',clientId:client.id}});await prisma.roundPool.create({data:{roundId:round.id,poolId:missing.id,order:1}});
  const historical=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:a.id,status:'INCOMPLETE',plannedDate:old}});
  await prisma.operationalReminder.create({data:{sourceKey:`incomplete:${historical.id}:${uuid()}`,title:'Regresso concluído QA',dueDate:old,isCompleted:true,metadata:{visitId:historical.id,resolvedByReturnVisitId:done.id}}});
  const coverage=await request('GET','/api/rounds/coverage');assert.equal(coverage.status,200);
  const row=coverage.body.rows.find(row=>row.poolId===pool.id);assert(row.flags.includes('STALE_COMPLETION'));assert(row.visits.find(v=>v.id===pending.id).issues.includes('OVERDUE'));assert(!row.visits.find(v=>v.id===started.id).canTransfer);assert(!row.visits.some(v=>v.id===historical.id));
  assert(coverage.body.rows.find(row=>row.poolId===missing.id).flags.includes('NOT_SCHEDULED_TODAY'));
  const login=await request('POST','/api/technician-auth/login',{pin:a.pin});
  assert.equal(login.status,200);assert.equal(typeof login.body.token,'string');
  const foreign=await fetch(BASE+'/api/rounds/coverage',{headers:{Authorization:`Bearer ${login.body.token}`}});assert.equal(foreign.status,403);
  const service=require('../src/services/autoVisitAlertService');await Promise.all([service.runAutoVisitAlerts(),service.runAutoVisitAlerts()]);
  const where={eventType:'VISIT_COVERAGE',metadata:{path:['poolId'],equals:pool.id}};assert.equal(await prisma.notification.count({where}),1);assert.equal((await prisma.notification.findFirst({where})).role,'ADMIN');
  const payload={visitIds:[pending.id],technicianId:b.id,reason:'Falta de produtos químicos: confirmar stock da viatura de apoio'};
  const endpoint='/api/rounds/transfer-visits';
  assert.equal((await request('POST',endpoint,{...payload,visitIds:[pending.id,started.id],preview:true})).status,409);
  let preview=await request('POST',endpoint,{...payload,preview:true});assert.equal(preview.status,200);assert.equal((await prisma.serviceVisit.findUnique({where:{id:pending.id}})).technicianId,a.id);
  await prisma.serviceVisit.update({where:{id:pending.id},data:{notes:'Alteração simultânea da gestão'}});
  assert.equal((await request('POST',endpoint,{...payload,expected:preview.body.visits,requestId:uuid()})).status,409);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:pending.id}})).technicianId,a.id);
  preview=await request('POST',endpoint,{...payload,preview:true});const requestId=uuid();
  const replies=await Promise.all([request('POST',endpoint,{...payload,expected:preview.body.visits,requestId}),request('POST',endpoint,{...payload,expected:preview.body.visits,requestId})]);replies.forEach(reply=>assert.equal(reply.status,200,JSON.stringify(reply.body)));
  for(const changed of [{technicianId:a.id},{visitIds:[started.id]},{reason:'Motivo diferente reutilizando o mesmo pedido'}]){
    const rejected=await request('POST',endpoint,{...payload,...changed,expected:preview.body.visits,requestId});
    assert.equal(rejected.status,409,JSON.stringify(rejected.body));
  }
  const malformed=await request('POST',endpoint,{...payload,technicianId:a.id,expected:[null],requestId:uuid()});
  assert.equal(malformed.status,409,JSON.stringify(malformed.body));
  assert.equal(await prisma.technicalHistory.count({where:{type:'VISIT_REASSIGNED',poolId:pool.id}}),1);
  const saved=await prisma.serviceVisit.findUnique({where:{id:pending.id}});assert.equal(saved.technicianId,b.id);assert.equal(saved.plannedDate.getTime(),yesterday.getTime());assert.equal(saved.endAt,null);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:started.id}})).technicianId,a.id);
  // A real mobile office preview can be cancelled without writing, then confirmed.
  const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:authToken,user:adminUser});
    const page=await context.newPage();await openRoundsWithFilter(page,pool.name);await reportOptionalAssets(page,'coverage transfer');await selectRoundLanguage(page,'pt');
    await page.locator(`[data-transfer-visit="${pending.id}"]`).check();await page.locator('#coverageTechnician').selectOption(String(a.id));await page.locator('#coverageCause').selectOption({label:'Falta de produtos químicos'});await page.locator('#coverageReason').fill('Produto em falta confirmado; reposição na viatura');
    await page.locator('#coverageTransfer button').click();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal((await prisma.serviceVisit.findUnique({where:{id:pending.id}})).technicianId,b.id);
    await page.locator('#coverageTransfer button').click();await page.getByRole('dialog').getByRole('button',{name:'Transferir',exact:true}).click();await page.waitForFunction(()=>document.getElementById('coverageStatus').textContent.includes('transferida(s)'));
    assert.equal((await prisma.serviceVisit.findUnique({where:{id:pending.id}})).technicianId,a.id);
    for(const width of [320,390]){await page.setViewportSize({width,height:844});const sizes=await page.locator('#coveragePanel').evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth}));assert(sizes.scroll<=sizes.width+1,JSON.stringify(sizes));}
    if(process.env.CW_CAPTURE_UI==='true'){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await page.locator('#coverageTransfer').screenshot({path:'reports/field-ui/ADMIN_COVERAGE_TRANSFER.png'});}
    await context.close();
  }finally{await browser.close();}
  await prisma.client.update({where:{id:client.id},data:{archiveStatus:'PAUSA'}});assert(!(await service.getCoverage()).rows.some(row=>row.poolId===pool.id));await service.runAutoVisitAlerts();assert.equal(await prisma.notification.count({where:{...where,status:'PENDING'}}),0);
  await prisma.round.update({where:{id:round.id},data:{active:false}});
  console.log('PASS coverage ignores started-only maintenance, excludes paused clients, deduplicates office alerts and transfers pending work with preview/concurrency guards');
}

async function testRecurrence(adminUser){
  const assert=require('node:assert/strict'),schedule=require('../src/services/roundScheduleService'),business=require('../src/business/admin/RoundAssignmentBusiness');
  const monthly=await request('POST','/api/rounds',{name:'Mensal QA',recurrence:'MONTHLY',dayOfMonth:31,startsOn:'2032-02-01',endsOn:'2032-03-31'});assert.equal(monthly.status,200,JSON.stringify(monthly.body));const round=monthly.body.round;
  const client=await prisma.client.create({data:{name:'Cliente recorrência QA',active:true}}),tech=await prisma.technician.create({data:{name:'Técnico recorrência QA',active:true}});
  const pool=await prisma.pool.create({data:{name:'Piscina recorrência mensal QA',clientId:client.id,active:true,volumeM3:40,technicalSheet:{create:{volumeM3:40,disinfectionType:'CHLORINE'}}}});
  await prisma.roundPool.create({data:{roundId:round.id,poolId:pool.id,order:1}});await prisma.roundTechnician.create({data:{roundId:round.id,technicianId:tech.id}});
  const withTech=await prisma.round.findUnique({where:{id:round.id},include:{technicians:{include:{technician:true}}}});
  assert.equal(await business.generateVisit(withTech,{pool},new Date('2032-02-28T08:00:00')),null);
  const leap=await Promise.all([business.generateVisit(withTech,{pool},new Date('2032-02-29T08:00:00')),business.generateVisit(withTech,{pool},new Date('2032-02-29T08:00:00'))]);assert.equal(leap.filter(Boolean).length,1);
  assert(await business.generateVisit(withTech,{pool},new Date('2032-03-31T08:00:00')));assert.equal(await business.generateVisit(withTech,{pool},new Date('2032-04-30T08:00:00')),null);
  assert(schedule.matches({...round,startsOn:null,endsOn:null},new Date('2033-02-28T08:00:00')));assert(!schedule.matches(round,new Date('2032-03-30T08:00:00')));
  assert.equal((await request('PUT',`/api/rounds/${round.id}`,{endsOn:'2032-01-01'})).status,400);assert.equal((await request('POST','/api/rounds',{name:'Invalid QA',recurrence:'MONTHLY',dayOfMonth:32})).status,400);assert.equal((await request('POST','/api/rounds',{name:'Invalid QA',recurrence:'DAILY',startsOn:'2032-02-31'})).status,400);
  const monthPlan=await request('GET','/api/rounds/week?date=2032-02-29');assert.equal(monthPlan.status,200);assert.equal(monthPlan.body.plan.referenceDate,'2032-02-29');assert(monthPlan.body.plan.days.find(d=>d.calendarDate==='2032-02-29').rounds.some(r=>r.id===round.id));
  for(const invalid of ['2032-02-30','invalid','2032-02-29T99:00:00Z']){const rejected=await request('GET','/api/rounds/week?date='+encodeURIComponent(invalid));assert.equal(rejected.status,400);assert.equal(rejected.body.code,'INVALID_WEEK_DATE');}
  const start=new Date();start.setDate(start.getDate()+1);const end=new Date(start);end.setDate(end.getDate()+2);const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const daily=await request('POST','/api/rounds',{name:'Diária limitada QA',recurrence:'DAILY',startsOn:ymd(start),endsOn:ymd(end)});assert.equal(daily.status,200);
  const dailyPool=await prisma.pool.create({data:{name:'Piscina diária QA',clientId:client.id,active:true,volumeM3:40,technicalSheet:{create:{volumeM3:40,disinfectionType:'CHLORINE'}}}});
  await prisma.roundPool.create({data:{roundId:daily.body.round.id,poolId:dailyPool.id,order:1}});await prisma.roundTechnician.create({data:{roundId:daily.body.round.id,technicianId:tech.id}});
  const generated=await Promise.all([request('POST','/api/round-planner/generate',{}),request('POST','/api/round-planner/generate',{})]);generated.forEach(r=>assert.equal(r.status,200));
  const visits=await prisma.serviceVisit.findMany({where:{roundId:daily.body.round.id},orderBy:{plannedDate:'asc'}});assert.equal(visits.length,3);assert.equal(ymd(visits[0].plannedDate),ymd(start));assert.equal(ymd(visits[2].plannedDate),ymd(end));
  assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:'visit-receipt:'},OR:visits.map(v=>({metadata:{path:['visitId'],equals:v.id}}))}}),3);
  assert.equal((await request('PUT',`/api/rounds/${daily.body.round.id}`,{recurrence:'WEEKLY',dayOfWeek:0,startsOn:null,endsOn:null})).status,200);assert.equal(await prisma.serviceVisit.count({where:{roundId:daily.body.round.id}}),3);
  for(const id of [round.id,daily.body.round.id])await prisma.round.update({where:{id},data:{active:false}});
  const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(({token,user})=>{for(const k of ['token','cristalwater_jwt'])localStorage.setItem(k,token);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(user));},{token:authToken,user:adminUser});
    const page=await context.newPage();await openRoundsWithFilter(page,pool.name);await reportOptionalAssets(page,'recurrence');await selectRoundLanguage(page,'pt');
    const name='Mensal criada no ecrã QA '+Date.now();await page.locator('#roundName').fill(name);await page.locator('#roundRecurrence').selectOption('MONTHLY');assert(await page.locator('#roundWeekField').isHidden());assert(await page.locator('#roundMonthField').isVisible());
    await page.locator('#roundMonthDay').fill('31');await page.locator('#roundStartsOn').fill('2032-02-01');await page.locator('#roundEndsOn').fill('2032-03-31');await page.locator('#createRoundBtn').click();
    await page.waitForFunction(name=>[...document.querySelectorAll('.round-card')].some(card=>card.textContent.includes(name)),name);
    const created=await prisma.round.findFirst({where:{name}});assert.equal(created.recurrence,'MONTHLY');assert.equal(created.dayOfMonth,31);
    const card=page.locator(`.round-card[data-round-id="${created.id}"]`);for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});const sizes=await card.locator('.round-editor').evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth}));assert(sizes.scroll<=sizes.width+1,JSON.stringify(sizes));}
    await page.setViewportSize({width:390,height:844});if(process.env.CW_CAPTURE_UI)await card.screenshot({path:'reports/field-ui/ADMIN_MONTHLY_ROUND.png'});
    await card.locator('[data-round-field=recurrence]').selectOption('DAILY');assert(await card.locator('[data-schedule-month]').isHidden());await card.locator('[data-round-field=startsOn]').fill('2032-03-01');await card.locator('[data-round-field=endsOn]').fill('2032-03-03');const savedResponse=page.waitForResponse(r=>r.url().endsWith('/api/rounds/'+created.id)&&r.request().method()==='PUT');await card.locator('[data-save-round]').click();assert.equal((await savedResponse).status(),200);
    await page.waitForFunction(()=>document.querySelector('#roundsByDay')?.textContent.includes('Rondas diárias'));
    const edited=await prisma.round.findUnique({where:{id:created.id}});assert.equal(edited.recurrence,'DAILY');assert.equal(edited.endsOn.toISOString().slice(0,10),'2032-03-03');await prisma.round.update({where:{id:created.id},data:{active:false}});
    await context.close();
  }finally{await browser.close();}
  console.log('PASS daily/monthly recurrence, leap-year month end, inclusive window, preserved visits and concurrent generation');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

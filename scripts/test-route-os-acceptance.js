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
  const adminLogin = await request("POST", "/api/auth/login", {email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD});
  if (adminLogin.status !== 200 || !adminLogin.body?.token) throw new Error(`Admin login failed: ${adminLogin.status}`);
  authToken = adminLogin.body.token;
  await testRoundAssignmentPeriods(adminLogin.body.user);
  await testVisitCoverage(adminLogin.body.user);
  await testRecurrence(adminLogin.body.user);
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
    technician.status === 201 &&
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

  process.exit(ok ? 0 : 1);
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
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    await context.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({...user,role:'ADMIN'}));},{token:authToken,user:adminUser||{}});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(BASE+'/admin-rounds',{waitUntil:'networkidle'});
    await page.locator('#assignTechRound').selectOption(String(round.id));await page.locator('#assignTech').selectOption(String(b.id));
    await page.locator('#assignmentPeriod').selectOption('PERMANENT');assert(await page.locator('#assignmentEndField').isHidden());
    await page.locator('#assignmentStart').fill('2034-01-01');await page.locator('#assignmentReason').fill('Mudança permanente QA');
    const before=await prisma.roundAssignment.count({where:{roundId:round.id}});
    await page.locator('#assignTechBtn').click();
    await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('dialog').textContent(),/sem fim/);
    await page.getByRole('dialog').getByRole('button',{name:/Cancelar/i}).click();
    assert.equal(await prisma.roundAssignment.count({where:{roundId:round.id}}),before);
    assert.deepEqual(errors,[]);
    await context.close();
  }finally{await browser.close();}
  // Remove this template from later acceptance fixtures; preserve its history and assignments.
  await prisma.round.update({where:{id:round.id},data:{active:false}});
  console.log('PASS round date ranges include final day, cross years, expire to base, preserve started visits and generate once with assigned technician');
}

async function testVisitCoverage(adminUser){
  const assert=require('node:assert/strict'),uuid=()=>require('node:crypto').randomUUID();
  const old=new Date();old.setDate(old.getDate()-20);const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const a=await prisma.technician.create({data:{name:'Cobertura origem QA',active:true,pin:'984731'}}),b=await prisma.technician.create({data:{name:'Cobertura destino QA',active:true}});
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
    const page=await context.newPage();await page.goto(BASE+'/admin-rounds',{waitUntil:'networkidle'});
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
    const page=await context.newPage();await page.goto(BASE+'/admin-rounds',{waitUntil:'networkidle'});
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

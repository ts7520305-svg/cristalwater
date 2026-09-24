'use strict';
const { prisma } = require('../prismaClient');
function invalid() { throw Object.assign(Error('Dia ou filtros inválidos.'), { statusCode: 400 }); }
function parse(query = {}) {
  if (Object.keys(query).some(key => !['date', 'day', 'technicianId', 'vehicleId'].includes(key)) || query.date !== undefined && query.day !== undefined) invalid();
  const day = query.date ?? query.day ?? new Date().toISOString().slice(0, 10);
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) invalid();
  const start = new Date(day + 'T00:00:00.000Z');
  if (!Number.isFinite(+start) || start.toISOString().slice(0, 10) !== day) invalid();
  const filter = raw => { if (raw === undefined) return null; if (typeof raw !== 'string' || !/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 2147483647) invalid(); return Number(raw); };
  return { day, start, end: new Date(+start + 86400000), technicianFilter: filter(query.technicianId), vehicleFilter: filter(query.vehicleId) };
}
const sameDayWhere = (names, start, end) => ({ OR: names.map(name => ({ [name]: { gte: start, lt: end } })) });
const byId = rows => new Map(rows.map(row => [row.id, row]));
function byKey(rows, key) { const map = new Map(); for (const row of rows) { if (row[key] == null) continue; const id = Number(row[key]); if (!map.has(id)) map.set(id, []); map.get(id).push(row); } return map; }
const caps = { serviceVisit: 500, workGuide: 200, vehicleStockMovement: 1000, visitStateLog: 1000, technicianTrack: 3000, technician: 500, user: 500, locationLog: 3000, vehicle: 500 };
async function read(query, database = prisma) {
  const selection = parse(query);
  return database.$transaction(async tx => {
    const limits = [];
    function available(name) { if (!tx[name]) throw Error('Daily source unavailable'); return true; }
    const db = name => tx[name];
    // A failed source aborts the snapshot. Never substitute an empty list.
    async function bounded(label, fn) { const rows = await fn(), name = label.slice(6), cap = caps[name]; if (!Array.isArray(rows) || !cap) throw Error('Invalid daily source'); if (rows.length > cap) limits.push({ source: name, limit: cap }); return rows.slice(0, cap); }
    const { day, start, end, technicianFilter, vehicleFilter } = selection;

    const visitWhere = {
      ...sameDayWhere(['plannedDate', 'startAt', 'endAt', 'date'], start, end),
      ...(technicianFilter ? { technicianId: technicianFilter } : {}),
    };

    const visits = available('serviceVisit') ? await bounded('daily.serviceVisit', () => db('serviceVisit').findMany({
      where: visitWhere,
      include: {
        client: { select: { id: true, name: true } },
        pool: { select: { id: true, clientId: true, name: true, zone: true, address: true } },
        technician: { select: { id: true, name: true, vehicleId: true } },
        chemicals: true,
      },
      orderBy: [{ plannedDate: 'asc' }, { startAt: 'asc' }, { id: 'asc' }],
      take: 501,
    })) : [];

    const technicianIds = Array.from(new Set(visits.map((visit) => visit.technicianId).filter(Boolean).map(Number)));
    if (technicianFilter && !technicianIds.includes(technicianFilter)) technicianIds.push(technicianFilter);

    const visitIds = visits.map(visit => visit.id);
    const movements = visitIds.length && available('vehicleStockMovement') ? await bounded('daily.vehicleStockMovement', () => db('vehicleStockMovement').findMany({
      where: { createdAt: { gte: start, lt: end }, visitId: { in: visitIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1001,
    })) : [];
    const recordedGuideIds = [...new Set(movements.filter(m => !m.extraVisitId && m.workGuideId).map(m => m.workGuideId))];
    const guideChoices = [
      ...(recordedGuideIds.length ? [{ id: { in: recordedGuideIds } }] : []),
      ...(technicianIds.length ? [{ technicianId: { in: technicianIds }, OR: [{ createdAt: { gte: start, lt: end } }, { closedAt: { gte: start, lt: end } }] }] : []),
    ];
    const workGuides = guideChoices.length && available('workGuide') ? await bounded('daily.workGuide', () => db('workGuide').findMany({
      where: { OR: guideChoices },
      include: { vehicle: { select: { id: true, plate: true, name: true } }, guide: { select: { codeAT: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 201,
    })) : [];

    const stateLogs = available('visitStateLog') && visitIds.length ? await bounded('daily.visitStateLog', () => db('visitStateLog').findMany({
      where: { visitId: { in: visitIds }, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
      take: 1001,
    })) : [];

    const tracks = !vehicleFilter && available('technicianTrack') && technicianIds.length ? await bounded('daily.technicianTrack', () => db('technicianTrack').findMany({
      where: {
        technicianId: { in: technicianIds },
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: 'asc' },
      take: 3001,
    })) : [];

    const technicians = technicianIds.length && available('technician') ? await bounded('daily.technician', () => db('technician').findMany({
      where: { id: { in: technicianIds } },
      select: { id: true, name: true, email: true, vehicleId: true },
      orderBy: { name: 'asc' },
      take: 501,
    })) : [];

    const emailToTechnician = new Map(technicians.filter((tech) => tech.email).map((tech) => [String(tech.email).toLowerCase(), tech.id]));
    const users = !vehicleFilter && emailToTechnician.size && available('user') ? await bounded('daily.user', () => db('user').findMany({
      where: { email: { in: Array.from(emailToTechnician.keys()) } },
      select: { id: true, email: true },
      take: 501,
    })) : [];
    const userToTechnician = new Map(users.map((user) => [user.id, emailToTechnician.get(String(user.email || '').toLowerCase())]));
    const locationLogs = userToTechnician.size && available('locationLog') ? await bounded('daily.locationLog', () => db('locationLog').findMany({
      where: {
        userId: { in: Array.from(userToTechnician.keys()) },
        timestamp: { gte: start, lt: end },
      },
      orderBy: { timestamp: 'asc' },
      take: 3001,
    })) : [];

    const movementsByVisit = byKey(movements.filter((movement) => movement.visitId && !movement.extraVisitId), 'visitId');
    const stateLogsByVisit = byKey(stateLogs, 'visitId');
    const workGuidesByTech = byKey(workGuides.filter((guide) => guide.technicianId), 'technicianId');
    const technicianMap = byId(technicians);

    const vehicleIds = Array.from(new Set([
      ...technicians.map((tech) => tech.vehicleId).filter(Boolean),
      ...workGuides.map((guide) => guide.vehicleId).filter(Boolean),
      ...movements.map((movement) => movement.vehicleId).filter(Boolean),
      ...(vehicleFilter ? [vehicleFilter] : []),
    ].map(Number)));
    const vehicles = vehicleIds.length && available('vehicle') ? await bounded('daily.vehicle', () => db('vehicle').findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, plate: true },
      take: 501,
    })) : [];
    const vehicleMap = byId(vehicles);

    function inferWorkGuide(visit) {
      const visitMovements = movementsByVisit.get(visit.id) || [];
      const linked = [...new Set(visitMovements.map(m => m.workGuideId).filter(Boolean))];
      if (linked.length > 1) return null;
      const movementGuideId = linked[0];
      if (movementGuideId) return workGuides.find((guide) => guide.id === movementGuideId) || null;
      const guides = workGuidesByTech.get(visit.technicianId) || [];
      const ref = new Date(visit.startAt || visit.endAt || visit.plannedDate || visit.date || start);
      return guides.find((guide) => {
        const guideStart = new Date(guide.createdAt || start);
        const guideEnd = guide.closedAt ? new Date(guide.closedAt) : end;
        return ref >= guideStart && ref <= guideEnd;
      }) || guides[0] || null;
    }

    const rows = visits.map((visit) => {
      const technician = visit.technician || technicianMap.get(Number(visit.technicianId)) || null;
      const workGuide = inferWorkGuide(visit);
      const visitMovements = movementsByVisit.get(visit.id) || [];
      const linkedVehicles = [...new Set(visitMovements.map(m => m.vehicleId).filter(Boolean))];
      const vehicleId = linkedVehicles.length > 1 ? null : linkedVehicles[0] || workGuide?.vehicleId || technician?.vehicleId || null;
      const vehicle = vehicleId ? vehicleMap.get(Number(vehicleId)) || (workGuide?.vehicle?.id === vehicleId ? workGuide.vehicle : null) : null;

      return {
        id: visit.id,
        day,
        plannedAt: visit.plannedDate || visit.date || null,
        startAt: visit.startAt,
        endAt: visit.endAt,
        status: visit.status || 'PLANNED',
        client: visit.client || null,
        poolClientChanged: !!(visit.clientId && visit.pool?.clientId && visit.clientId !== visit.pool.clientId),
        pool: visit.pool || null,
        technician: technician ? { id: technician.id, name: technician.name } : null,
        vehicle,
        vehicleBasis: linkedVehicles.length > 1 ? 'AMBIGUOUS_MOVEMENTS' : visitMovements.some(m => m.vehicleId) ? 'RECORDED_MOVEMENT' : workGuide?.vehicleId ? 'INFERRED_GUIDE' : technician?.vehicleId ? 'CURRENT_TECHNICIAN' : 'UNCONFIRMED',
        workGuideBasis: new Set(visitMovements.map(m => m.workGuideId).filter(Boolean)).size > 1 ? 'AMBIGUOUS_MOVEMENTS' : workGuide ? (visitMovements.some(m => m.workGuideId === workGuide.id) ? 'RECORDED_MOVEMENT' : 'INFERRED_TECHNICIAN_TIME') : 'UNCONFIRMED',
        workGuide: workGuide ? {
          id: workGuide.id,
          vehicleId: workGuide.vehicleId,
          status: workGuide.status,
          createdAt: workGuide.createdAt,
          closedAt: workGuide.closedAt,
          guideId: workGuide.guideId,
          codeAT: workGuide.guide?.codeAT || null,
        } : null,
        chemicals: visit.chemicals || [],
        stockMovements: visitMovements,
        stockReviewCount: movements.filter(m => m.visitId === visit.id && m.extraVisitId != null).length,
        stateLogs: stateLogsByVisit.get(visit.id) || [],
      };
    }).filter((row) => !vehicleFilter || Number(row.vehicle?.id || row.vehicle?.vehicleId || row.vehicleId) === vehicleFilter);

    const timeline = [];
    for (const row of rows) {
      if (row.plannedAt) timeline.push({ at: row.plannedAt, type: 'VISIT_PLANNED', visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: 'Visita planeada', message: `${row.pool?.name || 'Piscina'} - ${row.client?.name || 'Cliente'}` });
      if (row.startAt) timeline.push({ at: row.startAt, type: 'VISIT_STARTED', visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: 'Visita iniciada', message: row.pool?.name || 'Piscina' });
      if (row.endAt) timeline.push({ at: row.endAt, type: ['DONE', 'COMPLETED'].includes(row.status) ? 'VISIT_DONE' : 'VISIT_ENDED', visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: ['DONE', 'COMPLETED'].includes(row.status) ? 'Visita concluída' : 'Fim registado (estado por confirmar)', message: row.pool?.name || 'Piscina' });
      for (const log of row.stateLogs) timeline.push({ at: log.createdAt, type: `STATE_${log.newState}`, visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: `Estado: ${log.newState}`, message: log.notes || log.reason || row.pool?.name || 'Visita', latitude: log.latitude, longitude: log.longitude });
      for (const movement of row.stockMovements) timeline.push({ at: movement.createdAt, type: 'STOCK_MOVEMENT', visitId: row.id, technicianId: movement.technicianId || row.technician?.id || null, vehicleId: movement.vehicleId || row.vehicle?.id || null, title: 'Material usado', message: `${movement.itemName} - ${movement.quantity} ${movement.unit || ''}`.trim() });
    }
    for (const point of vehicleFilter ? [] : tracks) timeline.push({ source: 'TECHNICIAN_TRACK', at: point.createdAt, type: 'GPS', technicianId: point.technicianId, title: 'GPS tecnico', message: `${point.latitude}, ${point.longitude}`, latitude: point.latitude, longitude: point.longitude });
    for (const point of vehicleFilter ? [] : locationLogs) {
      const technicianId = userToTechnician.get(point.userId) || null;
      timeline.push({ source: 'USER_LOCATION_CURRENT_EMAIL', at: point.timestamp || point.createdAt, type: 'GPS', technicianId, title: 'GPS tecnico', message: `${point.latitude}, ${point.longitude}`, latitude: point.latitude, longitude: point.longitude, accuracyM: point.accuracyM });
    }

    const visibleTimeline = timeline.filter(item => { const stamp = new Date(item.at).getTime(); return stamp >= start.getTime() && stamp < end.getTime(); });
    visibleTimeline.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

    return {
      ok: true, version: 2,
      period: { start: start.toISOString(), end: end.toISOString(), timeZone: 'UTC' },
      visitType: 'REGULAR', complete: limits.length === 0, limits,
      basis: { selection: 'ANY_RECORDED_VISIT_DATE_IN_DAY', pool: 'CURRENT_DETAILS', gps: vehicleFilter ? 'OMITTED_NO_RECORDED_VEHICLE' : 'SELECTED_TECHNICIANS_WITH_CURRENT_EMAIL_ASSOCIATION' },
      day,
      filters: { technicianId: technicianFilter || null, vehicleId: vehicleFilter || null },
      summary: {
        services: rows.length,
        done: rows.filter((row) => ['DONE', 'COMPLETED'].includes(row.status)).length,
        technicians: new Set(rows.map((row) => row.technician?.id).filter(Boolean)).size,
        vehicles: new Set(rows.map((row) => row.vehicle?.id).filter(Boolean)).size,
        gpsPoints: visibleTimeline.filter((item) => item.type === 'GPS').length,
        stockMovements: new Set(rows.flatMap(row => row.stockMovements.map(m => m.id))).size,
      },
      services: rows,
      timeline: visibleTimeline,
     };
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 20000 });
}
module.exports = { read, parse };

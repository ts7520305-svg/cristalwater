const records = new Map();

function now() {
  return new Date().toISOString();
}

function startDay({ employeeId, vehicleId = null, gps = null }) {
  if (!employeeId) {
    throw new Error("employeeId is required");
  }

  const record = {
    id: Date.now().toString(),
    employeeId,
    vehicleId,
    status: "WORKING",
    startedAt: now(),
    finishedAt: null,
    gpsStart: gps,
    gpsEnd: null,
    pauses: [],
    lunch: null,
  };

  records.set(record.id, record);
  return record;
}

function startPause(recordId) {
  const record = records.get(recordId);
  if (!record) throw new Error("Record not found");

  record.pauses.push({
    startedAt: now(),
    endedAt: null,
  });

  record.status = "PAUSED";
  return record;
}

function endPause(recordId) {
  const record = records.get(recordId);
  if (!record) throw new Error("Record not found");

  const pause = record.pauses[record.pauses.length - 1];
  if (!pause || pause.endedAt) {
    throw new Error("No active pause found");
  }

  pause.endedAt = now();
  record.status = "WORKING";
  return record;
}

function startLunch(recordId) {
  const record = records.get(recordId);
  if (!record) throw new Error("Record not found");

  if (record.lunch && !record.lunch.endedAt) {
    throw new Error("Lunch already started");
  }

  record.lunch = {
    startedAt: now(),
    endedAt: null,
  };

  record.status = "LUNCH";
  return record;
}

function endLunch(recordId) {
  const record = records.get(recordId);
  if (!record) throw new Error("Record not found");

  if (!record.lunch || record.lunch.endedAt) {
    throw new Error("No active lunch found");
  }

  record.lunch.endedAt = now();
  record.status = "WORKING";
  return record;
}

function finishDay(recordId, gps = null) {
  const record = records.get(recordId);
  if (!record) throw new Error("Record not found");

  record.finishedAt = now();
  record.gpsEnd = gps;
  record.status = "FINISHED";

  return record;
}

function getRecord(recordId) {
  return records.get(recordId);
}

module.exports = {
  startDay,
  startPause,
  endPause,
  startLunch,
  endLunch,
  finishDay,
  getRecord,
};

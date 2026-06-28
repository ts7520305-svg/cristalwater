function hasPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

async function getPoolRoundReadiness(prisma, poolId) {
  const id = Number(poolId);
  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      status: 400,
      missing: ["Piscina invalida"],
      message: "Piscina invalida para ronda."
    };
  }

  const pool = await prisma.pool.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      clientId: true,
      active: true,
      volumeM3: true,
      type: true,
      technicalSheet: {
        select: {
          id: true,
          volumeM3: true,
          disinfectionType: true
        }
      }
    }
  });

  if (!pool) {
    return {
      ok: false,
      status: 404,
      missing: ["Piscina nao encontrada"],
      message: "Piscina nao encontrada."
    };
  }

  const missing = [];

  if (!pool.clientId) missing.push("Cliente associado");
  if (pool.active === false) missing.push("Piscina ativa");
  if (!pool.technicalSheet) missing.push("Ficha tecnica");
  if (!hasPositiveNumber(pool.volumeM3) && !hasPositiveNumber(pool.technicalSheet?.volumeM3)) {
    missing.push("Volume em m3");
  }
  if (pool.technicalSheet && !String(pool.technicalSheet.disinfectionType || "").trim()) {
    missing.push("Tipo de tratamento");
  }

  return {
    ok: missing.length === 0,
    status: missing.length ? 409 : 200,
    pool,
    missing,
    message: missing.length
      ? `Piscina sem ficha operacional minima: ${missing.join(", ")}. Completa a ficha tecnica antes de entrar na ronda.`
      : "Piscina pronta para ronda."
  };
}

async function assertPoolReadyForRound(prisma, poolId) {
  const readiness = await getPoolRoundReadiness(prisma, poolId);
  if (!readiness.ok) {
    const error = new Error(readiness.message);
    error.status = readiness.status;
    error.readiness = readiness;
    throw error;
  }
  return readiness;
}

module.exports = {
  assertPoolReadyForRound,
  getPoolRoundReadiness
};

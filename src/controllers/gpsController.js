const { prisma } = require("../prismaClient");

// ==========================================
// HELPERS
// ==========================================

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ==========================================
// GUARDAR POSIÇÃO
// ==========================================

async function updateLocation(req, res) {
  try {
    const technicianId = Number(req.body.technicianId);

    // Aceitar ambos os formatos:
    // antigo: lat / lng
    // novo: latitude / longitude
    const lat = toNumber(req.body.lat ?? req.body.latitude);
    const lng = toNumber(req.body.lng ?? req.body.longitude);

    if (Number.isNaN(technicianId) || lat === null || lng === null) {
      return res.status(400).json({
        ok: false,
        error: "technicianId, lat e lng são obrigatórios"
      });
    }

    await prisma.technicianLocation.create({
      data: {
        technicianId,
        latitude: lat,
        longitude: lng
      }
    });

    return res.json({
      ok: true,
      message: "Localização guardada"
    });
  } catch (err) {
    console.error("ERRO updateLocation:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}

// ==========================================
// ÚLTIMA POSIÇÃO DE 1 TÉCNICO
// ==========================================

async function getLatestLocation(req, res) {
  try {
    const technicianId = Number(req.params.id);

    if (Number.isNaN(technicianId)) {
      return res.status(400).json({
        ok: false,
        error: "technicianId inválido"
      });
    }

    const loc = await prisma.technicianLocation.findFirst({
      where: {
        technicianId: technicianId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.json({
      ok: true,
      loc
    });
  } catch (err) {
    console.error("ERRO getLatestLocation:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}

// ==========================================
// ÚLTIMA POSIÇÃO DE TODOS OS TÉCNICOS
// ==========================================

async function getLiveLocations(req, res) {
  try {
    const technicians = await prisma.technician.findMany({
      where: {
        active: true
      },
      orderBy: {
        name: "asc"
      }
    });

    const techniciansWithLocation = [];

    for (const tech of technicians) {
      const loc = await prisma.technicianLocation.findFirst({
        where: {
          technicianId: tech.id
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      techniciansWithLocation.push({
        technicianId: tech.id,
        technicianName: tech.name,
        phone: tech.phone || null,
        email: tech.email || null,
        location: loc
      });
    }

    return res.json({
      ok: true,
      technicians: techniciansWithLocation
    });
  } catch (err) {
    console.error("ERRO getLiveLocations:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}

module.exports = {
  updateLocation,
  getLatestLocation,
  getLiveLocations
};
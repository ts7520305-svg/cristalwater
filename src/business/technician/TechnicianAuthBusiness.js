const jwt = require("jsonwebtoken");
const { prisma } = require("../../prismaClient");
const { getLanguageForIdentity } = require("../../services/languagePreferenceService");
const { normalizeRole } = require("../../utils/roles");
const { getJwtSecret } = require("../../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();

async function loginTechnician(payload = {}) {
  const { pin } = payload;

  if (!pin || !String(pin).trim()) {
    return {
      ok: false,
      status: 400,
      message: "PIN obrigatório",
    };
  }

  const cleanPin = String(pin).trim();
  const tech = await prisma.technician.findFirst({
    where: {
      pin: cleanPin,
      active: true,
    },
    orderBy: { id: "asc" },
  });

  if (!tech) {
    return {
      ok: false,
      status: 401,
      message: "PIN inválido (não existe técnico com este PIN)",
    };
  }

  const role = normalizeRole(tech.role || "TECHNICIAN");
  const language = await getLanguageForIdentity(
    { id: tech.id, email: tech.email, role },
    "pt"
  );

  return {
    ok: true,
    token: jwt.sign(
      {
        id: tech.id,
        technicianId: tech.id,
        name: tech.name,
        role,
        language,
      },
      JWT_SECRET,
      { expiresIn: "16h" }
    ),
    user: {
      id: tech.id,
      technicianId: tech.id,
      name: tech.name,
      role,
      language,
    },
    technician: {
      id: tech.id,
      name: tech.name,
      role,
      language,
    },
  };
}

module.exports = {
  loginTechnician,
};

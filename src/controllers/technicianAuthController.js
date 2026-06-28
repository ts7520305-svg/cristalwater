// ==========================================
// TECHNICIAN AUTH CONTROLLER
// ==========================================

const { prisma } = require("../prismaClient");
const jwt = require("jsonwebtoken");
const { getLanguageForIdentity } = require("../services/languagePreferenceService");
const { normalizeRole } = require("../utils/roles");

const JWT_SECRET = process.env.JWT_SECRET || "cristalwater_secret";

async function loginTechnician(req, res) {
  try {
    const { pin } = req.body;

    if (!pin || !String(pin).trim()) {
      return res.status(400).json({
        ok: false,
        message: "PIN obrigatório",
      });
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
      return res.status(401).json({
        ok: false,
        message: "PIN inválido (não existe técnico com este PIN)",
      });
    }

    const role = normalizeRole(tech.role || "TECHNICIAN");

    const language = await getLanguageForIdentity(
      { id: tech.id, email: tech.email, role },
      "pt"
    );

    return res.json({
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
    });
  } catch (err) {
    console.error("Erro login técnico:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro no login do técnico",
    });
  }
}

module.exports = { loginTechnician };

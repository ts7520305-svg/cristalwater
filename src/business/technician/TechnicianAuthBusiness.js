const jwt = require("jsonwebtoken");
const { prisma } = require("../../prismaClient");
const { getLanguageForIdentity } = require("../../services/languagePreferenceService");
const { normalizeRole } = require("../../utils/roles");
const { getJwtSecret } = require("../../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();
const pins=require("../../services/technicianPinService");

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
  if(cleanPin.length>72)return {ok:false,status:401,message:'Credenciais inválidas'};
  const matches=await pins.findMatches(prisma,cleanPin,{activeOnly:true,stopAfter:2});
  if(matches.length!==1)return {ok:false,status:401,message:'Credenciais inválidas'};
  const tech=await prisma.technician.findUnique({where:{id:matches[0]}});
  if(!tech?.active||tech.deletedAt||!await pins.matches(cleanPin,tech.pin)||!['TECHNICIAN','TEAM_LEADER'].includes(normalizeRole(tech.role)))return {ok:false,status:401,message:'Credenciais inválidas'};

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
        principalType: 'TECHNICIAN',
        techAuthVersion: tech.authVersion,
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

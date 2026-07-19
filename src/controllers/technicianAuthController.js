// ==========================================
// TECHNICIAN AUTH CONTROLLER
// ==========================================

const TechnicianAuthBusiness = require("../business/technician/TechnicianAuthBusiness");

async function loginTechnician(req, res) {
  try {
    const result = await TechnicianAuthBusiness.loginTechnician(req.body || {});

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        message: result.message,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("Erro login técnico:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro no login do técnico",
    });
  }
}

module.exports = { loginTechnician };

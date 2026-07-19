const TechnicianRouteBusiness = require("../business/technician/TechnicianRouteBusiness");

async function getTodayRoute(req, res) {
  try {
    const technicianId =
      Number(req.user?.technicianId) ||
      Number(req.params?.technicianId) ||
      Number(req.query?.technicianId);

    const result =
      await TechnicianRouteBusiness.getTodayRoute({
        technicianId,
        req,
      });

    return res.json(result);

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok:false,
      error:err.message
    });

  }
}

module.exports = {
  getTodayRoute,
};

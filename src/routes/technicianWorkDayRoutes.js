const express = require("express");
const router = express.Router();
const TechnicianWorkdayBusiness = require("../business/technician/TechnicianWorkdayBusiness");

router.post("/start", async (req, res) => {
  try {
    const result = await TechnicianWorkdayBusiness.startWorkday({ userId: req.body.userId });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.json({ ok: false });
  }
});

router.post("/end", async (req, res) => {
  try {
    const result = await TechnicianWorkdayBusiness.endWorkday({ userId: req.body.userId });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.json({ ok: false });
  }
});

router.get("/status/:userId", async (req, res) => {
  try {
    const result = await TechnicianWorkdayBusiness.getWorkdayStatus({ userId: req.params.userId });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.json({ ok: false });
  }
});

module.exports = router;
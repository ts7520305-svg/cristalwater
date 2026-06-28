const express = require("express");
const router = express.Router();
const c = require("../controllers/enterpriseCrmController");
function wrap(fn){ return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }
router.get("/leads", wrap(c.listLeads));
router.post("/leads", wrap(c.createLead));
router.put("/leads/:id", wrap(c.updateLead));
router.post("/leads/:id/activity", wrap(c.addLeadActivity));
router.post("/leads/:id/convert", wrap(c.convertLeadToClient));
router.get("/appointments", wrap(c.listAppointments));
router.post("/appointments", wrap(c.createAppointment));
router.put("/appointments/:id", wrap(c.updateAppointment));
router.get("/reminders", wrap(c.listReminders));
router.post("/reminders", wrap(c.createReminder));
router.post("/reminders/:id/complete", wrap(c.completeReminder));
module.exports = router;

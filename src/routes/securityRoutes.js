const express = require("express");
const router = express.Router();
const c = require("../controllers/securityController");
function wrap(fn){ return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }
router.get("/status", wrap(c.securityStatus));
router.get("/audit", wrap(c.auditLogs));
router.post("/users/:id/change-password", wrap(c.changePassword));
router.post("/users/:id/reset-password", wrap(c.resetPassword));
router.put("/users/:id/identity", wrap(c.updateIdentity));
module.exports = router;

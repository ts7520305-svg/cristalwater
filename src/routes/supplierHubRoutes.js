const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/supplierHubController");
function wrap(fn){ return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }
router.use(auth("ADMIN"));
router.get("/suppliers", wrap(c.listSuppliers));
router.post("/suppliers", wrap(c.createSupplier));
router.put("/suppliers/:id", wrap(c.updateSupplier));
router.post("/suppliers/:id/reveal", wrap(c.revealSupplierPassword));
router.get("/links", wrap(c.listQuickLinks));
router.post("/links", wrap(c.createQuickLink));
module.exports = router;

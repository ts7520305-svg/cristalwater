const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/supplierHubController");
function wrap(fn){ return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }
router.use((req,res,next)=>{res.set({"Cache-Control":"private, no-store","Pragma":"no-cache"});next();});
router.use(auth("ADMIN"));
router.get("/result/:kind/:requestId", wrap(c.result));
router.post("/cancel/:kind/:requestId", wrap(c.cancel));
router.get("/suppliers", wrap(c.listSuppliers));
router.post("/suppliers", wrap(c.createSupplier));
router.put("/suppliers/:id", wrap(c.updateSupplier));
router.post("/suppliers/:id/reveal", wrap(c.revealSupplierPassword));
router.get("/links", wrap(c.listQuickLinks));
router.post("/links", wrap(c.createQuickLink));
module.exports = router;

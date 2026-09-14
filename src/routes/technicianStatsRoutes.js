const express = require("express");
const router = express.Router();
const TechnicianStatsController = require("../controllers/technicianStatsController");

const auth=require('../middlewares/authMiddleware');
const {roleMatches}=require('../utils/roles');
router.use(auth('TECHNICIAN'));
router.get("/", auth('TEAM_LEADER'), TechnicianStatsController.listTechnicianStats);
router.get("/:id", (req,res,next)=>{
  if (!roleMatches(req.user.role,'TEAM_LEADER') && Number(req.params.id)!==Number(req.user.technicianId||req.user.id))return res.status(403).json({ok:false,error:'Acesso apenas às próprias estatísticas'});
  next();
}, TechnicianStatsController.getTechnicianStats);

module.exports = router;
const express = require("express");
const ruleService = require("../services/operationalRiskRulesReviewService");
const ruleContract = require("../../frontend/cw-operational-risk-rules");
const summaryService = require("../services/operationalRiskSummaryService");
const router = express.Router();

router.use(require('../middlewares/authMiddleware')('ADMIN'));
router.get('/rules',async(req,res)=>{res.set('Cache-Control','private, no-store');try{res.json({ok:true,...await ruleService.effective(),defaults:ruleContract.defaults});}catch(e){res.status(e.statusCode||503).json({ok:false,code:e.code==='RISK_RULES_DATA_REVIEW'?e.code:'RISK_RULES_UNAVAILABLE'});}});
router.put('/rules',require('../controllers/operationalRiskRulesReviewController').legacy);
router.get('/summary',async(req,res)=>{res.set('Cache-Control','private, no-store');try{res.json(await summaryService.read());}catch(e){res.status(e.statusCode||503).json({ok:false,code:e.code==='RISK_RULES_DATA_REVIEW'?e.code:'RISK_SUMMARY_UNAVAILABLE'});}});
module.exports=router;

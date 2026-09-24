const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const reportVisitController = require("../controllers/reportVisitController");

router.use(auth());

const origins=require('../services/visitReportOriginService');
const originAction=fn=>async(req,res)=>{res.set('Cache-Control','private, no-store');try{if(Object.keys(req.query).length)throw Object.assign(Error('Opções inválidas.'),{statusCode:400});res.json(await fn(req));}catch(error){res.status(error.statusCode||503).json({ok:false,error:error.statusCode?error.message:'Não foi possível confirmar a revisão. Conserve o pedido.'});}};
router.get('/origin/:visitType/:id',auth('ADMIN'),originAction(req=>origins.detail(req.user,req.params.visitType,req.params.id)));
router.post('/origin/:visitType/:id/preview',auth('ADMIN'),originAction(req=>origins.preview(req.user,req.params.visitType,req.params.id,req.body)));
router.post('/origin/:visitType/:id/commands',auth('ADMIN'),originAction(req=>origins.command(req.user,req.params.visitType,req.params.id,req.body)));
router.get('/origin/:visitType/:id/requests/:requestId',auth('ADMIN'),originAction(req=>origins.recover(req.user,req.params.visitType,req.params.id,req.params.requestId)));

// RELATÓRIO PDF DA VISITA
router.get("/visit/:id", reportVisitController.generateVisitReport);

module.exports = router;
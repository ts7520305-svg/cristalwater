const express = require('express');
const router = express.Router();
const controller = require('../controllers/poolCalculationController');
const reviewed = require('../services/poolCalculatorWriteService');
const auth = require('../middlewares/authMiddleware');
router.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');next();});
router.use(auth('ADMIN'));
router.use((req,res,next)=>{res.set({'X-CW-Calculator':'pool-calculator-v2','X-CW-Owner':'ADMIN:'+Number(req.user.userId||req.user.id)});next();});
const run=handler=>async(req,res)=>{try{res.json(await handler(req));}catch(error){res.status(error.statusCode||500).json({ok:false,code:error.statusCode?error.code:'CALCULATOR_UNAVAILABLE',message:error.statusCode?error.message:'Não foi possível confirmar a operação. Conserve o pedido e tente confirmar novamente.'});}};
router.get('/requests/:requestId',run(req=>reviewed.recover(req.user,req.params.requestId)));
router.get('/:poolId/edit-state',run(req=>reviewed.read(req.user,req.params.poolId)));
router.post('/:poolId/reviewed',run(req=>reviewed.write(req.user,req.params.poolId,req.body)));

const legacy=handler=>(req,res,next)=>Promise.resolve(handler(req,res)).catch(next);
router.post('/preview', legacy(controller.previewCalculation));
router.get('/:poolId', legacy(controller.getPoolCalculations));
router.post('/:poolId', legacy(controller.savePoolCalculations));
router.put('/:poolId', legacy(controller.savePoolCalculations));

module.exports = router;

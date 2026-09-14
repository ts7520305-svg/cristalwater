const router=require('express').Router();
const service=require('../services/browserPushService');
router.use(require('../middlewares/authMiddleware')());
router.get('/public-key',(req,res)=>res.json({ok:true,configured:service.configured(),publicKey:service.configured()?service.configuration().publicKey:null}));
router.post('/subscriptions',async(req,res,next)=>{
 try {const row=await service.subscribe(req.user,req.body);res.json({ok:true,id:row.id})}
 catch(error){if(error.statusCode)return res.status(error.statusCode).json({ok:false,error:error.message});next(error)}
});
router.delete('/subscriptions',async(req,res,next)=>{try{await service.unsubscribe(req.user,req.body?.endpoint);res.json({ok:true})}catch(error){next(error)}});
module.exports=router;

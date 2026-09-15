const business=require('../business/system/DataRetentionBusiness');
const actor=req=>`${req.user.principalType || 'USER'}:${req.user.userId || req.user.id}`;
const handle=fn=>async(req,res,next)=>{try{return res.json(await fn(req));}catch(error){if(error.status)return res.status(error.status).json({ok:false,error:error.message});next(error);}};
module.exports={preview:handle(req=>business.preview(actor(req))),execute:handle(req=>business.execute(actor(req),req.body||{}))};

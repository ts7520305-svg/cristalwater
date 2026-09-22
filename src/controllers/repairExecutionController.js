'use strict';
const service=require('../services/repairExecutionCommandService');
const business=require('../business/repair/RepairBusiness');
const handle=fn=>async(req,res)=>{res.set('Cache-Control','private, no-store');try{res.json(await fn(req));}catch(e){const status=[400,403,404,409].includes(e.status||e.statusCode)?e.status||e.statusCode:500;res.status(status).json({ok:false,message:status===500?'Não foi possível confirmar a operação. Preserve o pedido e consulte o resultado.':e.message});}};
module.exports={list:handle(req=>service.list(req.query)),detail:handle(req=>service.detail(req.params.id)),lookup:handle(req=>service.lookup(req.user,req.params.id,req.params.requestId,req.query.payloadHash)),complete:handle(req=>business.completeRepair(req.params.id,null,req.user.email||req.user.name||req.user.role,req.user,req.body||{}))};

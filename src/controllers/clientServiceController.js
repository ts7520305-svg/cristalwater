'use strict';
const service=require('../services/clientServiceScheduleService');
const respond=fn=>async(req,res,next)=>{try{res.json(await fn(req));}catch(error){const status=error.status||error.statusCode;if(status)return res.status(status).json({ok:false,error:error.message});next(error);}};
module.exports={
  read:respond(req=>service.read(req.params.clientId)),
  preview:respond(req=>service.preview(req.params.clientId,req.body||{},true)),
  calendarPreview:respond(req=>service.preview(req.params.clientId,req.body||{},false)),
  save:respond(req=>service.write(req.params.clientId,req.body||{},req.user,true)),
  generate:respond(req=>service.write(req.params.clientId,req.body||{},req.user,false)),
};

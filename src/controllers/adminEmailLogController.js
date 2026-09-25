"use strict";
const service=require('../services/emailHistoryService');
async function listEmailLogs(req,res){
  try{const result=await service.read(req.user,req.query);res.set({'X-CW-Email-History':'email-history-v1','X-CW-Owner':result.owner});return res.json(result);}
  catch(error){const status=[400,403].includes(error.statusCode)?error.statusCode:503;return res.status(status).json({ok:false,message:status===503?'Não foi possível confirmar o histórico de emails.':error.message});}
}
module.exports={listEmailLogs};

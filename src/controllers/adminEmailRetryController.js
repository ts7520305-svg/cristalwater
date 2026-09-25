"use strict";
const {prisma}=require('../prismaClient');
async function retryFailed(req,res){
  const value=req.params.id;if(!/^[1-9]\d*$/.test(value)||Number(value)>2147483647)return res.status(400).json({ok:false,message:'ID inválido.'});
  try{
    const log=await prisma.emailLog.findUnique({where:{id:Number(value)},select:{id:true,eventType:true,status:true}});
    if(!log)return res.status(404).json({ok:false,message:'Registo não encontrado.'});
    // Legacy logs do not certify a complete message, its attachments or a safe
    // repeat. Sending replacement text must never convert the original to SENT.
    return res.status(409).json({ok:false,code:'SOURCE_REVIEW_REQUIRED',sent:0,message:log.eventType==='MONTHLY_REPORT'?'Reveja este envio no ecrã de revisão de emails dos relatórios.':'Reveja o documento ou pedido original antes de preparar um novo envio.'});
  }catch{return res.status(503).json({ok:false,sent:0,message:'Não foi possível confirmar o registo de email.'});}
}
module.exports={retryFailed};

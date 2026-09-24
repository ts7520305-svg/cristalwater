'use strict';
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{prisma}=require('../../src/prismaClient');
module.exports=async function({admin}){
  const f=await require('./maintenance-cost-data')({admin,extra:7}),resources=require('../../src/services/reminderResourceService');
  const tech=await prisma.technician.create({data:{name:f.tag+' técnico com nome completo para apresentação',active:true}}),otherTech=await prisma.technician.create({data:{name:f.tag+' outro técnico',active:true}});
  const reminders=f.sources.filter(s=>s.kind==='REMINDER'),basisIds=[],requests=[],visits=[];
  const declarePreview=async(reminderId,data,recordId=null)=>(await resources.preview(admin,reminderId,{action:recordId?'VOID':'DECLARE',recordId,data:recordId?null:data})).preview;
  const resourceBody=p=>({requestId:randomUUID(),action:p.action,recordId:p.recordId,data:p.proposed,previewHash:p.hash,reason:'Horas próprias e técnico conferidos para custo',confirmed:true});
  async function record(index,start,end,technicianId=tech.id){const reminderId=reminders[index].row.id,p=await declarePreview(reminderId,{technicianId,materials:{mode:'NONE',items:[]},workTime:start?{startedAt:start,endedAt:end}:null});assert(p.available,JSON.stringify(p));const result=await resources.command(admin,reminderId,resourceBody(p));assert(result.applied,JSON.stringify(result));return prisma.reminderResourceDeclaration.findUniqueOrThrow({where:{id:result.event.recordId}});}
  async function voidWork(row){const p=await declarePreview(row.reminderId,null,row.id);assert(p.available,JSON.stringify(p));const r=await resources.command(admin,row.reminderId,resourceBody(p));assert(r.applied,JSON.stringify(r));return r;}
  async function salary({amountCents=100,paidMinutes=3,technicianId=tech.id,periodStart='2008-07-01',periodEnd='2008-07-31'}={}){const e=await f.expense({category:'LABOR',amountCents,title:f.tag+' trabalho '+f.expenseIds.length});const r=await f.send('SET_LABOR_BASIS',e.expenseId,{technicianId,periodStart,periodEnd,paidMinutes,reason:'Documento e todo o tempo pago conferidos',confirmed:true});assert(r.applied);return {expenseId:e.expenseId};}
  async function cleanup(){
    await prisma.laborCostValuationPart.deleteMany({where:{group:{basisId:{in:basisIds}}}});await prisma.laborCostValuation.deleteMany({where:{basisId:{in:basisIds}}});await prisma.laborCostBasis.deleteMany({where:{id:{in:basisIds}}});await prisma.fieldWriteRequest.deleteMany({where:{requestId:{in:requests}}});
    const ids=reminders.map(s=>s.row.id),rows=await prisma.reminderResourceDeclaration.findMany({where:{reminderId:{in:ids}}});await prisma.userAuditLog.deleteMany({where:{action:resources.rules.scope,entityId:{in:rows.map(r=>String(r.id))}}});await prisma.fieldWriteRequest.deleteMany({where:{scope:resources.rules.scope,resourceId:{in:ids}}});await prisma.technicalHistory.deleteMany({where:{type:resources.rules.scope,poolId:f.pool.id}});await prisma.reminderResourceDeclaration.deleteMany({where:{reminderId:{in:ids}}});
    await prisma.expenseLaborBasis.deleteMany({where:{expenseId:{in:f.expenseIds}}});await prisma.expenseLaborDistribution.deleteMany({where:{expenseId:{in:f.expenseIds}}});await f.cleanup();
    for(const [model,id]of visits)await prisma[model].deleteMany({where:{id}});
    await prisma.technician.deleteMany({where:{id:{in:[tech.id,otherTech.id]}}});
  }
  return {...f,tech,otherTech,reminders,basisIds,requests,visits,declarePreview,resourceBody,record,voidWork,salary,cleanup};
};

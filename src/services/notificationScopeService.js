const {Prisma}=require('@prisma/client');
const {normalizeRole}=require('../utils/roles');
const financialTerms=['PAYMENT','INVOICE','DEBT','BILL','FINANCE','FATUR','PAGAMENTO','DIVIDA','COBRANCA'];
const criticalEvents=['WATER_OPEN_CREATED','WATER_OPEN_OVERDUE','PUMP_MANUAL_CREATED','PUMP_MANUAL_OVERDUE'];
function canSeeFinancialNotification(notification={}){return criticalEvents.includes(notification.eventType)||!['type','eventType','title','message'].some(field=>new RegExp(financialTerms.join('|'),'i').test(String(notification[field]||'')));}
function activeFor(user={}){
 const role=normalizeRole(user.role),active={status:{not:'SUPERSEDED'},OR:[{eventType:null},{eventType:{notIn:criticalEvents}},{status:{not:'RESOLVED'}}]};
 if(role==='ADMIN')return active;
 if(role==='CLIENT')return {...active,clientId:Number(user.clientId||user.id)||-1,role:{in:['CLIENT','CUSTOMER']}};
 if(!['TECHNICIAN','TEAM_LEADER'].includes(role))return {...active,id:-1};
 const technicianId=Number(user.technicianId||user.id)||-1;
 return {...active,role:{in:['TECHNICIAN','TECH','TECNICO','TEAM_LEADER']},AND:[
  {OR:[{metadata:{path:['technicianId'],equals:technicianId}},{metadata:{path:['technicianId'],equals:String(technicianId)}},{metadata:{path:['technicianId'],equals:Prisma.AnyNull}}]},
  {OR:[{userId:null},{userId:0},{userId:Number(user.id)||-1}]},
  {OR:[{eventType:{in:criticalEvents}},{AND:['type','eventType','title','message'].map(field=>{const safe={NOT:{OR:financialTerms.map(term=>({[field]:{contains:term,mode:'insensitive'}}))}};return ['eventType','title'].includes(field)?{OR:[{[field]:null},safe]}:safe;})}]}
 ]};
}
module.exports={activeFor,canSeeFinancialNotification};

'use strict';
module.exports=async function({prisma,cli,dbRejects,expenseId,clientId,completion}){
  const assert=require('node:assert/strict');
  const before=await prisma.$queryRaw`SELECT to_jsonb(a) AS row FROM "ExpenseAllocation" a ORDER BY id`;
  cli(['db','execute','--file','prisma/migrations/20260923060000_maintenance_expense_attribution/migration.sql','--schema','prisma/schema.prisma']);
  assert.deepEqual(await prisma.$queryRaw`SELECT to_jsonb(a)-'maintenanceCompletionId'-'serviceReminderId' AS row FROM "ExpenseAllocation" a ORDER BY id`,before);
  assert.equal(await prisma.expenseAllocation.count({where:{OR:[{maintenanceCompletionId:{not:null}},{serviceReminderId:{not:null}}]}}),0);
  const source=await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({where:{id:completion.id},include:{plan:true}});
  const plan=await prisma.equipmentMaintenancePlan.create({data:{poolId:source.plan.poolId,component:'FILTER',title:'Migration maintenance cost',instructions:'Retained source',intervalUnit:'MONTHS',intervalCount:1,nextDue:new Date('2000-01-01Z')}});
  const equipment=await prisma.equipmentMaintenanceCompletion.create({data:{planId:plan.id,version:1,visitId:source.visitId,requestId:'migration-maintenance-cost',actor:'ADMIN:1',fingerprint:'retained',notes:'Retained execution',result:{historical:true}}});
  const reminder=await prisma.generalReminder.create({data:{clientId,poolId:source.plan.poolId,title:'Historical service reminder',category:'POOL_SERVICE_REMINDER',status:'DONE',completedAt:new Date('2000-01-02Z'),dueAt:new Date('2000-01-02Z')}});
  const base={expenseId,monthRef:'2000-01',amountCents:100,clientId,targetHash:'retained',targetSnapshot:{historical:true},expenseHash:'retained',expenseSnapshot:{historical:true},reason:'Confirmed expense share',createdById:1};
  const a=await prisma.expenseAllocation.create({data:{...base,targetType:'MAINTENANCE_EQUIPMENT',maintenanceCompletionId:equipment.id,activeKey:'migration-equipment-cost'}});
  const b=await prisma.expenseAllocation.create({data:{...base,targetType:'MAINTENANCE_REMINDER',serviceReminderId:reminder.id,activeKey:'migration-reminder-cost'}});
  for(const [row,field,other] of [[a,'maintenanceCompletionId','serviceReminderId'],[b,'serviceReminderId','maintenanceCompletionId']])for(const assignment of [`"${field}"=NULL`,`"${field}"=0`,`"${field}"=-1`,`"${other}"=1`,`"visitId"=${source.visitId}`,`"extraVisitId"=1`,`"repairId"=1`,`"clientId"=NULL`,`"targetType"='CLIENT'`,`"valuationType"='LABOR'`,`"valuationType"='MATERIAL'`])await dbRejects(`UPDATE "ExpenseAllocation" SET ${assignment} WHERE id=${row.id}`,'23514');
  await prisma.equipmentMaintenanceCompletion.delete({where:{id:equipment.id}});await prisma.generalReminder.delete({where:{id:reminder.id}});
  assert.deepEqual(await prisma.expenseAllocation.findUniqueOrThrow({where:{id:a.id}}),a);assert.deepEqual(await prisma.expenseAllocation.findUniqueOrThrow({where:{id:b.id}}),b);
  await prisma.expenseAllocation.deleteMany({where:{id:{in:[a.id,b.id]}}});await prisma.equipmentMaintenancePlan.delete({where:{id:plan.id}});
};

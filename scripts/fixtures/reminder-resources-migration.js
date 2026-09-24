'use strict';
module.exports=async function({prisma,cli,dbRejects}){
  const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
  const tables=['GeneralReminder','FieldWriteRequest','RepairWorkInterval','ServiceVisit','ExtraVisit','StockMovement','ExpenseAllocation','CompanyExpense','OperationalReminder'];
  const snapshot=()=>Promise.all(tables.map(t=>prisma.$queryRawUnsafe('SELECT to_jsonb(a) AS row FROM "'+t+'" a ORDER BY id'))),before=await snapshot();
  cli(['db','execute','--file','prisma/migrations/20260924090000_reminder_resource_declarations/migration.sql','--schema','prisma/schema.prisma']);
  assert.deepEqual(await snapshot(),before);assert.equal(await prisma.reminderResourceDeclaration.count(),0);
  const reminder=await prisma.generalReminder.create({data:{title:'Migration independent reminder',category:'POOL_SERVICE_REMINDER',status:'DONE',dueAt:new Date('2000-01-01Z'),completedAt:new Date('2000-01-02Z'),clientId:1,poolId:1}});
  const data={reminderId:reminder.id,clientId:1,poolId:1,technicianId:1,owner:'ADMIN:1',requestId:randomUUID(),fingerprint:'a'.repeat(64),snapshot:{retained:true},result:{retained:true},activeKey:'REMINDER:'+reminder.id,startedAt:new Date('2000-01-01T10:00:00Z'),endedAt:new Date('2000-01-01T11:00:00Z')};
  const row=await prisma.reminderResourceDeclaration.create({data});
  for(const assignment of ['"technicianId"=0','"owner"=\'TECH:1\'','"fingerprint"=\'bad\'','"startedAt"=NULL','"endedAt"="startedAt"','"activeKey"=NULL','"activeKey"=\'REMINDER:0\'','"voidedBy"=\'ADMIN:1\'','"voidedAt"=CURRENT_TIMESTAMP,"activeKey"=NULL','"voidedAt"=CURRENT_TIMESTAMP,"activeKey"=NULL,"voidedBy"=\'ADMIN:1\'','"voidedAt"=CURRENT_TIMESTAMP,"activeKey"=NULL,"voidReason"=\'Explicit correction\''])await dbRejects('UPDATE "ReminderResourceDeclaration" SET '+assignment+' WHERE id='+row.id,'23514');
  const duplicate='INSERT INTO "ReminderResourceDeclaration" ("reminderId","clientId","poolId","technicianId","owner","requestId","fingerprint","snapshot","result","activeKey") SELECT "reminderId","clientId","poolId","technicianId","owner",\''+randomUUID()+'\',"fingerprint","snapshot","result","activeKey" FROM "ReminderResourceDeclaration" WHERE id='+row.id;
  await dbRejects(duplicate,'23505');assert.deepEqual(await prisma.generalReminder.findUniqueOrThrow({where:{id:reminder.id}}),reminder);
  await prisma.generalReminder.delete({where:{id:reminder.id}});assert.deepEqual(await prisma.reminderResourceDeclaration.findUniqueOrThrow({where:{id:row.id}}),row);
  await prisma.reminderResourceDeclaration.update({where:{id:row.id},data:{voidedAt:new Date(),voidedBy:'ADMIN:1',voidReason:'Explicit correction',activeKey:null}});
  const replacement=await prisma.reminderResourceDeclaration.create({data:{...data,requestId:randomUUID(),startedAt:null,endedAt:null}});
  await dbRejects('UPDATE "ReminderResourceDeclaration" SET "requestId"=\''+data.requestId+'\' WHERE id='+replacement.id,'23505');
  await prisma.reminderResourceDeclaration.deleteMany({where:{reminderId:reminder.id}});assert.deepEqual(await snapshot(),before);
};

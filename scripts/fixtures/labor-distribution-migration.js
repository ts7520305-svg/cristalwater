'use strict';
module.exports=async function({prisma,cli,dbRejects,expenseId,repairLabor}){
 const assert=require('node:assert/strict');
 const before=await prisma.$queryRaw`SELECT to_jsonb(a) AS row FROM "ExpenseAllocation" a ORDER BY id`,documents=await prisma.companyExpense.findMany(),events=await prisma.expenseEvent.findMany(),bases=await prisma.expenseLaborBasis.findMany();
 cli(['db','execute','--file','prisma/migrations/20260923070000_labor_expense_distribution/migration.sql','--schema','prisma/schema.prisma']);
 assert.deepEqual(await prisma.$queryRaw`SELECT to_jsonb(a) AS row FROM "ExpenseAllocation" a ORDER BY id`,before);assert.deepEqual(await prisma.companyExpense.findMany(),documents);assert.deepEqual(await prisma.expenseEvent.findMany(),events);assert.deepEqual(await prisma.expenseLaborBasis.findMany(),bases);assert.equal(await prisma.expenseLaborDistribution.count(),0);
 const row=await prisma.expenseLaborDistribution.create({data:{expenseId,amountCents:100,snapshot:{version:1,basis:'CONFIRMED_EXPENSE_LABOR_DISTRIBUTION',parts:[{historical:1},{historical:2}]},fingerprint:'a'.repeat(64),activeKey:String(expenseId),reason:'Explicit historical shares',createdById:1}});
 for(const change of [`"amountCents"=0`,`"reason"=' '`,`"createdById"=0`,`"fingerprint"='bad'`,`"activeKey"=NULL`,`"activeKey"='other'`,`"voidedAt"=CURRENT_TIMESTAMP`,`"snapshot"='{}'`,`"snapshot"=jsonb_set("snapshot",'{parts}','[]')`])await dbRejects(`UPDATE "ExpenseLaborDistribution" SET ${change} WHERE id=${row.id}`,'23514');
 await dbRejects(`INSERT INTO "ExpenseLaborDistribution" ("expenseId","amountCents","snapshot","fingerprint","activeKey","reason","createdById") SELECT "expenseId","amountCents","snapshot","fingerprint","activeKey","reason","createdById" FROM "ExpenseLaborDistribution" WHERE id=${row.id}`,'23505');
 await dbRejects(`DELETE FROM "CompanyExpense" WHERE id=${expenseId}`,['23001','23503']);await dbRejects(`UPDATE "ExpenseLaborDistribution" SET "expenseId"=2147483647,"activeKey"='2147483647' WHERE id=${row.id}`,'23503');
 await dbRejects(`UPDATE "ExpenseAllocation" SET "valuationSnapshot"=jsonb_set("valuationSnapshot",'{source,version}','5') WHERE id=${repairLabor.id}`,'23514');
 await prisma.expenseLaborDistribution.update({where:{id:row.id},data:{voidedAt:new Date(),voidReason:'Retain history',activeKey:null}});assert.deepEqual((await prisma.expenseLaborDistribution.findUniqueOrThrow({where:{id:row.id}})).snapshot,row.snapshot);await prisma.expenseLaborDistribution.delete({where:{id:row.id}});
};

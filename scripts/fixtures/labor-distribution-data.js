'use strict';
const {prisma}=require('../../src/prismaClient');
module.exports=async function({admin}){
 const f=await require('./repair-labor-data')({admin});
 const parts=[{technicianId:f.tech.id,periodStart:'2004-01-01',periodEnd:'2004-01-31',paidMinutes:3,amountCents:100},{technicianId:f.second.id,periodStart:'2004-01-01',periodEnd:'2004-01-31',paidMinutes:1,amountCents:200},{technicianId:f.tech.id,periodStart:'2004-02-01',periodEnd:'2004-02-29',paidMinutes:1,amountCents:50}];
 await prisma.serviceVisit.update({where:{id:f.regular.id},data:{startAt:new Date('2004-01-03T09:00:00Z'),endAt:new Date('2004-01-03T09:01:00Z')}});
 await prisma.extraVisit.update({where:{id:f.extra.id},data:{startAt:new Date('2004-02-02T09:00:00Z'),endAt:new Date('2004-02-02T09:01:00Z')}});
 return {...f,parts,document:()=>f.salary({amountCents:350,paidMinutes:5}),cleanup:async()=>{await prisma.expenseLaborDistribution.deleteMany({where:{expenseId:{in:f.expenses}}});await prisma.expensePayment.deleteMany({where:{expenseId:{in:f.expenses}}});await f.cleanup();}};
};

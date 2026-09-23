'use strict';
const r=require('./expenseLedgerRules'),distribution=require('./expenseLaborDistributionService');
const shared=['technicianId','periodStart','periodEnd','paidMinutes'];
function choices(value){
 if(!Array.isArray(value)||value.length<2||value.length>20)r.fail('Escolha entre duas e vinte despesas diferentes.');
 for(const [i,c] of value.entries()){r.object(c,['expenseId','laborPart']);r.id(c.expenseId);if(c.laborPart!==null){r.id(c.laborPart);if(c.laborPart>20)r.fail('Parcela de trabalho inválida.');}if(i&&c.expenseId<=value[i-1].expenseId)r.fail('Escolha uma componente por despesa, por ordem de identificador.');}
 return value.map(c=>({...c}));
}
const selections=snapshot=>snapshot?.version===1?null:snapshot?.version===2?choices(snapshot.components.map(c=>({expenseId:c.expenseId,laborPart:c.laborDistribution?.partIndex??null}))):r.fail('Versão da composição por rever.',409);
const identities=snapshot=>snapshot.components.map(c=>({expenseId:c.expenseId,distributionId:c.laborDistribution?.id??null,laborPart:c.laborDistribution?.partIndex??null}));
const activeKey=snapshot=>r.hash(snapshot.components.some(c=>c.laborDistribution)?{version:2,components:identities(snapshot)}:snapshot.components.map(c=>c.expenseId));
function select(expense,laborPart){
 const value=distribution.selection(expense,laborPart);
 if(value?.error)r.fail(value.error,409);
 if(expense.cancelledAt||expense.category!=='LABOR'||expense.sourceType!=='MANUAL')r.fail('Use despesas manuais de trabalho ainda válidas.',409);
 const basis=value?.basis||require('./expenseValuationSources').laborBasis(expense.laborBasis);
 if(!basis||!value&&!expense.laborBasis?.technician)r.fail('Confirme o técnico, período e tempo pago da componente.',409);
 return {basis,amountCents:value?.part.amountCents??expense.amountCents,technicianName:value?.part.technicianName??expense.laborBasis.technician.name,...(value?{laborDistribution:value.proof}:{})};
}
function facts(expenses,selected=null){
 if(expenses.length<2||expenses.length>20)r.fail('Escolha entre duas e vinte despesas de trabalho.',409);
 if(selected){choices(selected);if(selected.length!==expenses.length||expenses.some((e,i)=>e.id!==selected[i].expenseId))r.fail('As componentes não correspondem aos documentos.',409);}
 let first;const components=expenses.map((e,i)=>{
  const c=select(e,selected?.[i].laborPart??null);if(!first)first=c.basis;
  if(!shared.every(k=>c.basis[k]===first[k]))r.fail('As componentes têm de confirmar o mesmo técnico, período e tempo pago.',409);
  r.money(c.amountCents);return {expenseId:e.id,expense:require('./expenseCostAllocationService').expenseSnapshot(e),laborBasis:c.basis,...(c.laborDistribution?{laborDistribution:c.laborDistribution}:{})};
 });
 const amountCents=components.reduce((n,c)=>n+amount(c),0);r.money(amountCents);
 return {version:selected?2:1,kind:'CONFIRMED_LABOR_COST_COMPOSITION',...Object.fromEntries(shared.map(k=>[k,first[k]])),amountCents,components};
}
function amount(c){return c.laborDistribution?c.laborDistribution.snapshot.parts.find(p=>p.index===c.laborDistribution.partIndex).amountCents:c.expense.amountCents;}
function marker(snapshot,basisId,basisFingerprint,groupId){return {version:snapshot.version,basisId,basisFingerprint,groupId,primaryExpenseId:snapshot.components[0].expenseId,expenseIds:snapshot.components.map(c=>c.expenseId),...(snapshot.version===2?{components:identities(snapshot)}:{})};}
function options(expense){
 const rows=distribution.active(expense);
 if(rows.length){if(rows.length!==1||distribution.inspect(expense,rows[0]).state!=='CONFIRMED')return [];return rows[0].snapshot.parts.map(p=>({laborPart:p.index,...select(expense,p.index)}));}
 return expense.laborBasis?.technician?[{laborPart:null,...select(expense,null)}]:[];
}
module.exports={choices,selections,identities,activeKey,select,facts,amount,marker,options};

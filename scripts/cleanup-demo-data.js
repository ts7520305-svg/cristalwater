
require('../src/loadEnv')();
const prisma = require('../src/prismaClient');
const db = prisma.prisma || prisma.default || prisma;
async function main(){
  const clients = await db.client.findMany({ where: { OR: [{ name: { contains: 'Demo', mode: 'insensitive' } }, { name: { contains: 'Teste Flow', mode: 'insensitive' } }] } });
  for (const c of clients) await db.client.update({ where:{id:c.id}, data:{ active:false, status:'ARCHIVED', paymentStatus:'BILLING_DISABLED' } });
  const techs = await db.technician.findMany({ where: { name: { contains: 'Demo', mode: 'insensitive' } } });
  for (const t of techs) await db.technician.update({ where:{id:t.id}, data:{ active:false } });
  const pools = await db.pool.findMany({ where: { OR: [{ name: { contains: 'Demo', mode: 'insensitive' } }, { name: { contains: 'Teste', mode: 'insensitive' } }] } });
  for (const p of pools) await db.pool.update({ where:{id:p.id}, data:{ active:false, scheduleMode:'ARCHIVED' } });
  console.log(`Arquivados: ${clients.length} clientes, ${pools.length} piscinas, ${techs.length} técnicos de demonstração/teste.`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>db.$disconnect());

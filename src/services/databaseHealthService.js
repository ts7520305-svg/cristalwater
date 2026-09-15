const {prisma}=require('../prismaClient');
async function checkDatabaseHealth(db=prisma){
  try{
    await db.$queryRaw`SELECT 1`;
    return {ok:true,database:'ONLINE'};
  }catch(_){
    return {ok:false,database:'ERROR',error:'Base de dados temporariamente indisponível.'};
  }
}
module.exports={checkDatabaseHealth};

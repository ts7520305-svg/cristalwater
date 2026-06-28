const db=require("../prisma/BusinessPrisma");

(async()=>{

const result=await db.health();

console.log(JSON.stringify(result,null,2));

process.exit(result.ok?0:1);

})();

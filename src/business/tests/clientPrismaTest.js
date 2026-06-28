const client = require("../prisma/ClientPrismaService");

(async()=>{

console.log("Clientes:",await client.count());

console.log("Primeiro:");

console.log(await client.first());

})();

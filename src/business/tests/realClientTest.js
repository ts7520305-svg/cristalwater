const service=require("../real/RealClientService");

(async()=>{

console.log("Clientes:",await service.count());

console.log("Ativos:");

console.log(await service.active());

})();

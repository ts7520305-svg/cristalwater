const repo = require("./ClientRepository");

(async()=>{

console.log("Clientes:",await repo.count());

console.log(await repo.findAll({
    take:2,
    orderBy:{id:"asc"}
}));

})();

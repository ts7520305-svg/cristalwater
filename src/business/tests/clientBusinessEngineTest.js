const engine=require("../engine/ClientBusinessEngine");

(async()=>{

console.log(

await engine.count()

);

console.log(

await engine.byId(2)

);

})();

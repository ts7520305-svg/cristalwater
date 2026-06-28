const visit = require("../real/RealVisitService");

(async()=>{

console.log("Visitas:",await visit.count());

console.log(await visit.today());

})();

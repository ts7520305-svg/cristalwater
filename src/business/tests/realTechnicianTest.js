const tech = require("../real/RealTechnicianService");

(async()=>{

console.log("Tecnicos:", await tech.count());

console.log("Primeiro:");

const list = await tech.all();

console.log(list[0]);

})();

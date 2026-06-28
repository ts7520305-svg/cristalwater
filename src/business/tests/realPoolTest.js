const pool = require("../real/RealPoolService");

(async()=>{

console.log("Piscinas:",await pool.count());

console.log("Primeira:");

const list = await pool.all();

console.log(list[0]);

})();

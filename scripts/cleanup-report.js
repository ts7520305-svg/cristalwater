const fs = require("fs");
const path = require("path");

const root =
  path.join(__dirname, "..");

const suspicious = [];

function scan(dir){

  const items =
    fs.readdirSync(dir, { withFileTypes:true });

  items.forEach(item => {

    const full =
      path.join(dir, item.name);

    if (
      item.name === "node_modules" ||
      item.name === ".git" ||
      item.name === "uploads" ||
      item.name === "logs"
    ){
      return;
    }

    if (item.isDirectory()){
      scan(full);
      return;
    }

    const lower =
      item.name.toLowerCase();

    if (
      lower.includes("old") ||
      lower.includes("backup") ||
      lower.includes("copy") ||
      lower.includes("teste") ||
      lower.includes("novo") ||
      lower.includes("final")
    ){
      suspicious.push(full);
    }
  });
}

scan(root);

console.log("\nPossíveis ficheiros para rever, NÃO apagar automaticamente:\n");

suspicious.forEach(file => {
  console.log(file);
});
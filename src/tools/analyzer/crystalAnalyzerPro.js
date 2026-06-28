const fs = require("fs");
const path = require("path");

function walk(dir){
    if(!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
        const p=path.join(dir,e.name);
        return e.isDirectory() ? walk(p) : [p];
    });
}

const files = walk("src");

const report = {
    generatedAt:new Date().toISOString(),
    totalFiles:files.length,
    controllers:[],
    routes:[],
    services:[],
    duplicatedImports:[],
    largeFiles:[]
};

for(const file of files){

    if(!file.endsWith(".js")) continue;

    const txt = fs.readFileSync(file,"utf8");

    const lines = txt.split("\n").length;

    if(file.includes("/controllers/"))
        report.controllers.push(file);

    if(file.includes("/routes/"))
        report.routes.push(file);

    if(file.includes("/services/"))
        report.services.push(file);

    if(lines>500){

        report.largeFiles.push({
            file,
            lines
        });

    }

    const imports=[...txt.matchAll(/require\((.*?)\)/g)].map(x=>x[1]);

    const dup=imports.filter((v,i,a)=>a.indexOf(v)!==i);

    if(dup.length){

        report.duplicatedImports.push({
            file,
            duplicated:[...new Set(dup)]
        });

    }

}

fs.writeFileSync(
"reports/crystal-analyzer-pro.json",
JSON.stringify(report,null,2)
);

console.log(JSON.stringify(report,null,2));

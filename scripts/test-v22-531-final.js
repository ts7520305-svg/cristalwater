
const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..','frontend');
const mustNot=['Cliente WOW','Portal WOW','Fluxo harmonizado','Testar flow completo','Cliente Demo','Piscina Demo','Técnico Demo','Intelligence Layer','preo'];
let bad=[];for(const f of fs.readdirSync(root)){if(!/\.(html|js|css)$/.test(f))continue;const t=fs.readFileSync(path.join(root,f),'utf8');for(const s of mustNot){if(t.includes(s))bad.push(`${f}: ${s}`)}}
const mustFiles=['admin-clients.html','admin-clients.js','admin-pools.html','admin-pools.js','admin-technicians.html','admin-technicians.js','client-portal.html','technician-field-mode.html','admin-pool-calculator.html'];
for(const f of mustFiles){if(!fs.existsSync(path.join(root,f)))bad.push(`missing ${f}`)}
if(bad.length){console.error(bad.join('\n'));process.exit(1)}
console.log('V22.5.3.1 final static checks OK');

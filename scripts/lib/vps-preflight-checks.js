const path=require('path');
const {spawnSync}=require('child_process');
const webPush=require('web-push');
function configurationChecks(env={}){
 const checks=[];
 const add=(name,ok,detail)=>checks.push({name,ok,detail:ok?'':detail});
 add('NODE_ENV',env.NODE_ENV==='production','Obrigatório production para a instalação de campo.');
 add('QA_MODE',String(env.QA_MODE||'').toLowerCase()!=='true','QA_MODE desativa os avisos e o agendamento de campo.');
 add('JWT_SECRET',typeof env.JWT_SECRET==='string'&&env.JWT_SECRET.length>=32&&!['cristalwater_secret','trocar_esta_chave_em_producao'].includes(env.JWT_SECRET),'Chave própria com pelo menos 32 caracteres obrigatória.');
 let databaseValid=false;try{const url=new URL(env.DATABASE_URL);databaseValid=['postgres:','postgresql:'].includes(url.protocol)&&Boolean(url.hostname)&&url.pathname.length>1;}catch{}
 add('DATABASE_URL',databaseValid,'Ligação PostgreSQL válida obrigatória; o valor não é apresentado.');
 const port=Number(env.PORT);add('PORT',Number.isInteger(port)&&port>0&&port<=65535,'Porta de 1 a 65535 obrigatória.');
 add('ALLOW_LEGACY_PLAIN_PASSWORDS',String(env.ALLOW_LEGACY_PLAIN_PASSWORDS||'').toLowerCase()!=='true','Passwords antigas em texto simples não podem ficar autorizadas.');
 const origins=String(env.CORS_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
 add('CORS_ORIGIN',origins.length>0&&origins.every(origin=>{try{const u=new URL(origin);return u.protocol==='https:'&&u.origin===origin&&!u.username&&!u.password;}catch{return false;}}),'Defina origens HTTPS explícitas, sem wildcard ou caminhos.');
 add('EXTERNAL_NOTIFICATIONS_ENABLED',env.EXTERNAL_NOTIFICATIONS_ENABLED===undefined||String(env.EXTERNAL_NOTIFICATIONS_ENABLED).trim().toLowerCase()==='true','Os avisos externos têm de estar ativos na instalação de campo.');
 let pushValid=false;try{webPush.setVapidDetails(env.WEB_PUSH_SUBJECT,env.WEB_PUSH_PUBLIC_KEY,env.WEB_PUSH_PRIVATE_KEY);pushValid=true;}catch{}
 add('Web Push VAPID',pushValid,'Configure assunto e par de chaves Web Push válidos; a entrega real ainda precisa de ensaio no telemóvel.');
 if(env.ADMIN_PASSWORD)add('ADMIN_PASSWORD',!['admin','password','trocar_esta_password'].includes(env.ADMIN_PASSWORD),'A password de exemplo não pode ficar ativa.');
 return checks;
}
function inspectSchema({root,env=process.env,targetSchemaPath}={}){
 const schema=path.join(root,'prisma/schema.prisma');
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','diff','--from-schema-datasource',schema,'--to-schema-datamodel',targetSchemaPath||schema,'--exit-code'],{cwd:root,env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 if(result.error||result.status!==0)return {name:'Esquema PostgreSQL',ok:false,detail:result.status===2?'O esquema difere desta versão. Rever migrações e baseline antes de instalar.':'Não foi possível confirmar o esquema no prazo previsto. Nenhuma migração foi aplicada.'};
 return {name:'Esquema PostgreSQL',ok:true,detail:'Comparação de leitura sem diferenças; nenhuma migração aplicada.'};
}
module.exports={configurationChecks,inspectSchema};

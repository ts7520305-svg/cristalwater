/* Component regression: real HTML, auth/guard, visit and navigation sources.
 * API responses and accounts below are explicit QA fixtures, not SQL acceptance. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken');
const root=path.resolve(__dirname,'../frontend'),secret='navigation-component-test-only';
const source=fs.readFileSync(path.join(root,'technician-visit.html'),'utf8');
const sources=new Set(['/cw-auth.js','/technician-auth-guard.js','/technician-visit.js','/ui/core/navigation-context.js']);
// Keep the native form and scripts under test; avoid unrelated navigation/help/SW
// initialization in this component fixture. No application source is rewritten.
const html=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>sources.has(tag.match(/src="([^"]+)"/)?.[1])?tag:'');
const actorA={id:12,role:'TECHNICIAN',technicianId:12,principalType:'TECH'},actorB={id:12,userId:12,role:'TECHNICIAN',technicianId:13,principalType:'USER'};
const tokenA=jwt.sign(actorA,secret,{expiresIn:'1h'}),tokenB=jwt.sign(actorB,secret,{expiresIn:'1h'});
let held=false,pending=[],reads=0,writes=0;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://qa.local');
 if(url.pathname.startsWith('/api/')){
  if(req.method!=='GET'){writes++;res.writeHead(405);return res.end('{}');}
  const match=url.pathname.match(/^\/api\/visits\/(\d+)$/);if(!match){res.writeHead(404);return res.end('{}');}
  const send=()=>{if(res.destroyed)return;let actor;try{actor=jwt.verify(String(req.headers.authorization||'').replace(/^Bearer /,''),secret);}catch(_){res.writeHead(403);return res.end('{"error":"QA denied"}');}
   reads++;res.setHeader('Content-Type','application/json');const id=Number(match[1]);if(id===9){res.writeHead(403);return res.end('{"error":"QA denied visit"}');}
   res.end(JSON.stringify({visit:{id,status:'PLANNED',notes:'server '+actor.technicianId+'/'+id,ph:7.2,pool:{name:'QA Pool '+id},client:{name:'QA Client '+actor.technicianId}},context:{}}));};
  if(held)pending.push(send);else send();return;
 }
 if(url.pathname==='/technician-visit'){res.setHeader('Content-Type','text/html');return res.end(html);}
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('');}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  const executablePath=process.env.CW_CHROMIUM_EXECUTABLE||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined);
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({token,actor})=>{localStorage.setItem('cw_api_origin',location.origin);if(localStorage.getItem('token'))return;for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(actor));},{token:tokenA,actor:actorA});
  const base='http://127.0.0.1:'+server.address().port,legacy='cw:ctx:/technician-visit',old=' {"fields":{"notes":"unowned old account"}} ';
  const ready=async()=>{try{await page.waitForFunction(()=>window.CWVisitNavigationMemory?.scope()&&document.getElementById('statusBox').dataset.tone==='success');}catch(error){console.error('QA component state',await page.evaluate(()=>({path:location.pathname,status:document.getElementById('statusBox')?.textContent,scope:window.CWVisitNavigationMemory?.scope(),guard:!!window.CristalAuth,body:document.body.innerText.slice(-400)})),errors);throw error;}};
  await page.goto(base+'/technician-visit?visit=7');await ready();await page.evaluate(({legacy,old})=>sessionStorage.setItem(legacy,old),{legacy,old});
  await page.locator('#notes').fill('private A7');await page.locator('#ph').fill('7.8');await page.locator('#cleaned').check();await page.locator('#photo').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from('QA bytes')});
  held=true;await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('#notes').inputValue(),'');assert.equal(await page.locator('#notes').isDisabled(),true);assert.equal(await page.locator('#photo').evaluate(el=>el.files.length),0);
  held=false;pending.splice(0).forEach(send=>send());await ready();assert.equal(await page.locator('#notes').inputValue(),'private A7');assert.equal(await page.locator('#ph').inputValue(),'7.8');assert.equal(await page.locator('#cleaned').isChecked(),true);
  await page.locator('#notes').fill('latest A7');await page.locator('#refreshBtn').click();await ready();assert.equal(await page.locator('#notes').inputValue(),'latest A7');
  await page.evaluate(({token,actor})=>{CristalAuth.persistSession(token,actor);window.dispatchEvent(new Event('cw:session-change'));},{token:tokenB,actor:actorB});assert.equal(await page.locator('#notes').inputValue(),'');assert.equal(await page.locator('#notes').isDisabled(),true);
  await page.locator('#refreshBtn').click();await ready();assert.equal(await page.locator('#notes').inputValue(),'server 13/7');await page.locator('#notes').fill('private B7');await page.reload();await ready();assert.equal(await page.locator('#notes').inputValue(),'private B7');
  await page.evaluate(({token,actor})=>{CristalAuth.persistSession(token,actor);window.dispatchEvent(new Event('cw:session-change'));},{token:tokenA,actor:actorA});await page.locator('#refreshBtn').click();await ready();assert.equal(await page.locator('#notes').inputValue(),'latest A7');
  await page.goto(base+'/technician-visit?visit=8');await ready();assert.equal(await page.locator('#notes').inputValue(),'server 12/8');await page.locator('#notes').fill('private A8');await page.goto(base+'/technician-visit?visit=7');await ready();assert.equal(await page.locator('#notes').inputValue(),'latest A7');
  await page.goto(base+'/technician-visit?visit=9');await page.waitForFunction(()=>document.getElementById('statusBox').dataset.tone==='error');assert.equal(await page.locator('#notes').inputValue(),'');assert.equal(await page.locator('#notes').isDisabled(),true);
  assert.equal(await page.evaluate(legacy=>sessionStorage.getItem(legacy),legacy),old);assert.equal(writes,0);assert(reads>=8);assert.deepEqual(errors,[]);
  console.log('PASS visit navigation browser component: native HTML/auth/guard/visit/navigation, delayed reload, PIN/USER accounts, visit isolation, refresh, denied GET, file exclusion, legacy bytes; QA API fixtures only, zero writes');
 }finally{pending.splice(0).forEach(send=>send());await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

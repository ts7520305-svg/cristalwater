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
const intakeSources=new Set([...sources].filter(value=>value!=='/technician-visit.js').concat(['/cw-field-write-store.js','/cw-i18n.js','/technician-new-client.js']));
const intakeHtml=fs.readFileSync(path.join(root,'technician-new-client.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>intakeSources.has(tag.match(/src="([^"]+)"/)?.[1])?tag:'');
const actorA={id:12,role:'TECHNICIAN',technicianId:12,principalType:'TECH'},actorB={id:12,userId:12,role:'TECHNICIAN',technicianId:13,principalType:'USER'};
const tokenA=jwt.sign(actorA,secret,{expiresIn:'1h'}),tokenB=jwt.sign(actorB,secret,{expiresIn:'1h'});
let held=false,pending=[],navigationHeld=false,navigationPending=[],reads=0,writes=0;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://qa.local');
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/settings/language/me'){
   res.setHeader('Content-Type','application/json');
   return res.end(JSON.stringify({ok:true,language:'pt'}));
  }
  if(req.method!=='GET'){writes++;res.writeHead(405);return res.end('{}');}
  if(url.pathname==='/api/technician-intake/settings'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,techniciansCanCreateClientsPools:true,requireAdminReview:true,poolsActiveByDefault:false}));}
  const match=url.pathname.match(/^\/api\/visits\/(\d+)$/);if(!match){res.writeHead(404);return res.end('{}');}
  const send=()=>{if(res.destroyed)return;let actor;try{actor=jwt.verify(String(req.headers.authorization||'').replace(/^Bearer /,''),secret);}catch(_){res.writeHead(403);return res.end('{"error":"QA denied"}');}
   reads++;res.setHeader('Content-Type','application/json');const id=Number(match[1]);if(id===9){res.writeHead(403);return res.end('{"error":"QA denied visit"}');}
   res.end(JSON.stringify({visit:{id,status:'PLANNED',notes:'server '+actor.technicianId+'/'+id,ph:7.2,pool:{name:'QA Pool '+id},client:{name:'QA Client '+actor.technicianId}},context:{}}));};
  if(held)pending.push(send);else send();return;
 }
 if(url.pathname==='/technician-visit'){res.setHeader('Content-Type','text/html');return res.end(html);}
 if(url.pathname==='/technician-new-client'){res.setHeader('Content-Type','text/html');return res.end(intakeHtml);}
 if(url.pathname==='/sw.js'){res.writeHead(404);return res.end('');}
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('');}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');const sendFile=()=>{if(!res.destroyed)res.end(fs.readFileSync(file));};if(navigationHeld&&url.pathname==='/ui/core/navigation-context.js')navigationPending.push(sendFile);else sendFile();
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
  assert.equal(await page.evaluate(legacy=>sessionStorage.getItem(legacy),legacy),old);
  const draft={v:1,owner:'TECH:12',clientName:'Owned QA client',phone:'+351 900000000',email:'qa@example.test',address:'Owned address',zone:'Lagos',poolName:'Owned pool',poolType:'Privada',volumeM3:'75',latitude:'37.1',longitude:'-8.6',notes:'Owned intake note',requestId:null};
  const draftKey='cwFieldIntakeDraft:TECH:12',rawDraft=JSON.stringify(draft),intakeLegacy='cw:ctx:/technician-new-client';
  await page.evaluate(({draftKey,rawDraft,intakeLegacy})=>{localStorage.setItem(draftKey,rawDraft);sessionStorage.setItem(intakeLegacy,JSON.stringify({fields:{'intake-clientName':'Wrong previous account','intake-notes':'Wrong old note','intake-phone':'Wrong phone'}}));},{draftKey,rawDraft,intakeLegacy});
  navigationHeld=true;await page.goto(base+'/technician-new-client',{waitUntil:'commit'});
  await page.waitForFunction(()=>document.getElementById('intake-clientName')?.value==='Owned QA client'&&document.getElementById('result')?.textContent.includes('Rascunho desta conta'));
  const intakeCopies={
   en:{title:'➕ New client/pool in the field',result:'Draft for this account; not sent yet.',permission:'Registration allowed; forms require office review.',policy:'The form stays pending review. Saving does not confirm a scheduled visit.',gps:'Coordinates: 37.1, -8.6',submit:'Save provisional form',retry:'Confirm saved form',gpsButton:'📍 Use current location',name:'Client name *',placeholder:'E.g. Villa Silva',poolPrivate:'Private'},
   fr:{title:'➕ Nouveau client / piscine sur le terrain',result:'Brouillon de ce compte ; pas encore envoyé.',permission:'Inscription autorisée ; les fiches nécessitent une vérification du bureau.',policy:'La fiche reste en attente de vérification. L’enregistrement ne confirme pas de visite planifiée.',gps:'Coordonnées : 37.1, -8.6',submit:'Enregistrer la fiche provisoire',retry:'Confirmer la fiche enregistrée',gpsButton:'📍 Utiliser la position actuelle',name:'Nom du client *',placeholder:'Ex. : Villa Silva',poolPrivate:'Privée'},
   es:{title:'➕ Nuevo cliente/piscina en campo',result:'Borrador de esta cuenta; aún no enviado.',permission:'Registro permitido; las fichas requieren revisión de la oficina.',policy:'La ficha queda pendiente de revisión. Guardar no confirma una visita agendada.',gps:'Coordenadas: 37.1, -8.6',submit:'Guardar ficha provisional',retry:'Confirmar ficha guardada',gpsButton:'📍 Usar ubicación actual',name:'Nombre del cliente *',placeholder:'Ej.: Villa Silva',poolPrivate:'Privada'},
   de:{title:'➕ Neuer Kunde/Pool vor Ort',result:'Entwurf dieses Kontos; noch nicht gesendet.',permission:'Registrierung erlaubt; Formulare erfordern Prüfung durch das Büro.',policy:'Das Formular bleibt zur Prüfung offen. Speichern bestätigt keinen geplanten Besuch.',gps:'Koordinaten: 37.1, -8.6',submit:'Vorläufiges Formular speichern',retry:'Gespeichertes Formular bestätigen',gpsButton:'📍 Aktuellen Standort verwenden',name:'Kundenname *',placeholder:'z. B. Villa Silva',poolPrivate:'Privat'},
   pt:{title:'➕ Novo cliente/piscina em campo',result:'Rascunho desta conta; ainda não enviado.',permission:'Cadastro permitido; as fichas requerem revisão do escritório.',policy:'A ficha fica pendente de revisão. A gravação não confirma visita agendada.',gps:'Coordenadas: 37.1, -8.6',submit:'Guardar ficha provisória',retry:'Confirmar ficha guardada',gpsButton:'📍 Usar localização atual',name:'Nome do cliente *',placeholder:'Ex: Villa Silva',poolPrivate:'Privada'}
  };
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});
   for(const [language,expected] of Object.entries(intakeCopies)){
    await page.evaluate(language=>CristalI18n.applyLanguage(language),language);
    await page.waitForFunction(expected=>document.querySelector('h1')?.textContent===expected.title&&document.getElementById('result')?.textContent.includes(expected.result)&&document.getElementById('permissionBox')?.textContent.includes(expected.permission),expected);
    assert.equal(await page.locator('#intakePolicy').textContent(),expected.policy);
    assert.equal(await page.locator('#gpsState').textContent(),expected.gps);
    assert.equal(await page.locator('[type=submit]').textContent(),expected.submit);
    assert.equal(await page.locator('#intakeRetry').textContent(),expected.retry);
    assert.equal(await page.locator('#gpsBtn').textContent(),expected.gpsButton);
    assert.equal(await page.locator('label[for="intake-clientName"]').textContent(),expected.name);
    assert.equal(await page.locator('#intake-clientName').getAttribute('placeholder'),expected.placeholder);
    assert.equal(await page.locator('#intake-poolType option[value="Privada"]').textContent(),expected.poolPrivate);
    assert.equal(await page.locator('#intake-poolType').evaluate(node=>Array.from(node.options).map(option=>option.value).join('|')),'|Privada|Condomínio|Hotel|Jacuzzi');
    assert.equal(await page.locator('[name=clientName]').inputValue(),draft.clientName);
    assert.equal(await page.locator('[name=poolType]').inputValue(),draft.poolType);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),rawDraft);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(writes,0);
   }
  }
  await page.evaluate(()=>window.addEventListener('pageshow',()=>{window.qaIntakeAfterGeneric=Object.fromEntries(Array.from(document.getElementById('form').elements).filter(node=>node.name).map(node=>[node.name,node.value]));},{once:true}));
  navigationHeld=false;navigationPending.splice(0).forEach(send=>send());await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(()=>window.qaIntakeAfterGeneric);const afterGeneric=await page.evaluate(()=>window.qaIntakeAfterGeneric);
  for(const [name,value]of Object.entries(draft)){if(['v','owner','requestId'].includes(name))continue;assert.equal(afterGeneric[name],value,'Delayed generic restore must preserve owned intake '+name);assert.equal(await page.locator('[name="'+name+'"]').inputValue(),value,'Generic restore must preserve owned intake '+name);}
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),rawDraft);
  await page.locator('#intake-notes').fill('Edited owned intake');const edited=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftKey);assert.deepEqual(edited,{...draft,notes:'Edited owned intake'});
  const generic=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),intakeLegacy);assert(!Object.keys(generic.fields).some(id=>id.startsWith('intake')),'Managed intake excluded from generic saves');
  // An unsupported lock API fails before preparing or sending an operational request.
  await page.evaluate(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:undefined}));
  await page.locator('[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('result').textContent.startsWith('A ficha não foi enviada.'));
  const sendErrors={
   en:'The form was not sent. This browser cannot coordinate submissions. Keep the form.',
   fr:'La fiche n’a pas été envoyée. Ce navigateur ne permet pas de coordonner les envois. Conservez la fiche.',
   es:'La ficha no se envió. Este navegador no permite coordinar los envíos. Conserve la ficha.',
   de:'Das Formular wurde nicht gesendet. Dieser Browser kann Sendungen nicht koordinieren. Bewahren Sie das Formular auf.',
   pt:'A ficha não foi enviada. Este navegador não permite coordenar os envios. Preserve a ficha.'
  };
  for(const [language,expected]of Object.entries(sendErrors)){
   await page.evaluate(language=>CristalI18n.applyLanguage(language),language);
   assert.equal(await page.locator('#result').textContent(),expected,'Send error must follow the selected language');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),JSON.stringify(edited));
   assert.equal(await page.locator('#intake-notes').inputValue(),edited.notes);
   assert.equal(writes,0);
  }
  const literalError='QA literal: keep <original> & 123';
  await page.evaluate(message=>Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async()=>{throw Error(message);}}}),literalError);
  await page.locator('[type=submit]').click();
  await page.waitForFunction(message=>document.getElementById('result').textContent.includes(message),literalError);
  for(const [language,prefix]of [['en','The form was not sent.'],['de','Das Formular wurde nicht gesendet.'],['pt','A ficha não foi enviada.']]){
   await page.evaluate(language=>CristalI18n.applyLanguage(language),language);
   assert.equal(await page.locator('#result').textContent(),prefix+' '+literalError);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),JSON.stringify(edited));
   assert.equal(writes,0);
  }
  assert.equal(writes,0);assert(reads>=8);assert.deepEqual(errors,[]);
  console.log('PASS visit navigation browser component: native HTML/auth/guard/visit/navigation, delayed reload, PIN/USER accounts, visit isolation, refresh, denied GET, file exclusion, legacy bytes; native intake/write-store draft recovery, editing and five-language send errors with literal errors preserved; QA API fixtures only, zero writes');
 }finally{pending.splice(0).forEach(send=>send());navigationPending.splice(0).forEach(send=>send());await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

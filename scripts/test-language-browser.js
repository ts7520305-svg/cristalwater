const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
async function checkExcludedTraversal(browser){
 const privateRows=Array.from({length:2048},()=>'<div><span>Guardar</span><b>Conclu&iacute;do</b></div>').join('');
 const fixture='<!doctype html><html lang="pt"><meta charset="utf-8"><body><section id="fixture"><p id="eligible">Guardar</p><p id="freshState">Conclu&iacute;do</p><input id="typed" value="Literal Guardar" placeholder="Guardar"><select id="opted" data-cw-i18n-options><option value="LITERAL_CODE">Guardar</option></select><div id="dynamic"><span>Guardar</span></div><div id="privateRows" data-cw-no-i18n>'+privateRows+'</div><script id="inertScript" type="application/json">"Guardar"</script><style id="inertStyle">/* Guardar */</style><noscript id="inertNoscript">Guardar</noscript><textarea id="fieldArea" placeholder="Guardar">Guardar</textarea><code id="inertCode"><span>Guardar</span></code><pre id="inertPre"><span>Guardar</span></pre><svg id="inertSvg"><text>Guardar</text><foreignObject><p>Guardar</p></foreignObject></svg><canvas id="inertCanvas"><span>Guardar</span></canvas><select id="plainSelect"><option value="PRIVATE_CODE">Guardar</option></select><label id="manualLang" class="cw-lang-switch"><span>Guardar</span><select data-cw-i18n-options><option value="PRIVATE_LANG">Guardar</option></select></label><template id="templateHolder"><span>Guardar</span></template><div id="shadowHost"></div></section><script src="/cw-i18n.js"></script></body></html>';
 const saveCopy={pt:'Guardar',en:'Save',fr:'Enregistrer',es:'Guardar',de:'Speichern'},totals={matrices:0,ignoredTextVisits:0,rootCases:0,dynamicCases:0};
 for(const role of ['ADMIN','TECHNICIAN','CLIENT']){
  const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(role=>{
    localStorage.setItem('cw_language','pt');localStorage.setItem('cristalwater_user',JSON.stringify({id:7,role,language:'pt'}));
    const native=Document.prototype.createTreeWalker,skip='.cw-lang-switch, script, style, noscript, textarea, code, pre, svg, canvas, select:not([data-cw-i18n-options]), [data-cw-no-i18n]';
    window.qaWalks=[];
    Document.prototype.createTreeWalker=function(root,show,filter){
     if(root!==document.body||!filter)return native.call(this,root,show,filter);
     const record={nodes:[],ignoredTextVisits:0};qaWalks.push(record);
     const walker=native.call(this,root,show,{acceptNode(node){if(node.nodeType===Node.TEXT_NODE&&node.parentElement?.closest(skip))record.ignoredTextVisits++;return filter.acceptNode(node);}}),next=walker.nextNode.bind(walker);
     walker.nextNode=()=>{const node=next();if(node)record.nodes.push(node);return node;};return walker;
    };
    window.qaBeginTraversal=()=>{
     const walker=native.call(document,document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){return String(node.nodeValue||'').replace(/\s+/g,' ').trim()&&!node.parentElement?.closest(skip)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
     window.qaExpectedNodes=[];while(walker.nextNode())qaExpectedNodes.push(walker.currentNode);qaWalks=[];
    };
    window.qaTraversalProof=()=>({eligible:qaExpectedNodes.length,walks:qaWalks.length,equivalent:qaWalks.length?qaWalks.every(record=>record.nodes.length===qaExpectedNodes.length&&record.nodes.every((node,index)=>node===qaExpectedNodes[index])):qaExpectedNodes.length===0,ignoredTextVisits:qaWalks.reduce((sum,record)=>sum+record.ignoredTextVisits,0)});
   },role);
   await page.route('**/*',route=>new URL(route.request().url()).pathname==='/cw-i18n.js'?route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/cw-i18n.js'),'utf8')}):route.fulfill({contentType:'text/html',body:fixture}));
   await page.goto('http://traversal-language.test/');await page.waitForFunction(()=>window.CristalI18n&&document.getElementById('cwLanguageSelect'));
   const blocked=await page.evaluate(()=>{
    document.getElementById('shadowHost').attachShadow({mode:'open'}).innerHTML='<span>Guardar</span>';
    window.qaFixtureNodes=[...document.querySelectorAll('#fixture,#fixture *')];
    return ['privateRows','inertScript','inertStyle','inertNoscript','fieldArea','inertCode','inertPre','inertSvg','inertCanvas','plainSelect','manualLang','templateHolder','shadowHost'].map(id=>[id,document.getElementById(id).outerHTML]);
   });
   for(const [language,expected]of Object.entries(saveCopy)){
    await page.evaluate(()=>qaBeginTraversal());await page.locator('#cwLanguageSelect').selectOption(language);const proof=await page.evaluate(()=>qaTraversalProof());assert(proof.equivalent,'Eligible text nodes and order must match the original rule');totals.ignoredTextVisits+=proof.ignoredTextVisits;totals.matrices++;
    assert.equal(await page.locator('#eligible').textContent(),expected);assert.equal(await page.locator('#opted option').textContent(),expected);assert.equal(await page.locator('#opted').inputValue(),'LITERAL_CODE');assert.equal(await page.locator('#typed').inputValue(),'Literal Guardar');assert.equal(await page.locator('#typed').getAttribute('placeholder'),expected);
    for(const [id,html]of blocked)assert.equal(await page.locator('#'+id).evaluate(node=>node.outerHTML),html,'Excluded subtree must stay byte-identical');
    assert(await page.evaluate(()=>qaFixtureNodes.every(node=>node.isConnected)));assert.equal(await page.locator('#shadowHost').evaluate(node=>node.shadowRoot.textContent),'Guardar');
    assert.equal(await page.evaluate(role=>localStorage.getItem('cw_language:'+role.toLowerCase()+':7'),role),language);
   }
   for(const root of ['body','html']){
    const proof=await page.evaluate(root=>{const node=document.querySelector(root);node.setAttribute('data-cw-no-i18n','');const html=document.body.innerHTML;qaBeginTraversal();CristalI18n.applyLanguage('en');const result={...qaTraversalProof(),unchanged:html===document.body.innerHTML};node.removeAttribute('data-cw-no-i18n');return result;},root);
    assert.equal(proof.eligible,0);assert(proof.equivalent&&proof.unchanged);totals.ignoredTextVisits+=proof.ignoredTextVisits;totals.rootCases++;
   }
   for(const excluded of [true,false,true,false]){
    const proof=await page.evaluate(excluded=>{const node=document.getElementById('dynamic');node.toggleAttribute('data-cw-no-i18n',excluded);node.firstChild.firstChild.nodeValue='Conclu\u00eddo';qaBeginTraversal();CristalI18n.applyLanguage('en');return{...qaTraversalProof(),value:node.textContent};},excluded);
    assert(proof.equivalent);assert.equal(proof.value,excluded?'Conclu\u00eddo':'Completed');totals.ignoredTextVisits+=proof.ignoredTextVisits;totals.dynamicCases++;
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.log('QA global excluded traversal '+JSON.stringify({...totals,profiles:3,componentFixtureOnly:true,allEligibleNodesAndOrderCompared:true,allExcludedSubtreesAndInputValuesRetained:true}));
 assert.equal(totals.ignoredTextVisits,0,'Global translation must not visit text inside an already excluded subtree');
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let releaseRead,readStarted,releaseWrite,writeStarted;const writes=[];let holdWrite=true;
  const ready=new Promise(r=>readStarted=r),firstWrite=new Promise(r=>writeStarted=r);
  await page.addInitScript(()=>{localStorage.setItem('token','TECH-A');localStorage.setItem('cw_language','pt');localStorage.setItem('cristalwater_user',JSON.stringify({id:1,role:'TECHNICIAN',language:'pt'}));});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/test')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><p id="water">Água aberta</p><p id="state">Em curso</p><button id="save">Guardar</button><input id="note" value="Guardar"><p data-cw-no-i18n>Guardar</p><select id="reason" data-cw-i18n-options><option value="CHEMICAL_MISSING">Falta de produtos químicos</option></select><script src="/cw-i18n.js"></script>'});
   if(u.pathname==='/cw-i18n.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/cw-i18n.js'),'utf8')});
   if(route.request().method()==='GET'){assert.equal(route.request().headers().authorization,'Bearer TECH-A');readStarted();await new Promise(r=>releaseRead=r);return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,language:'de'})});}
   const p=route.request().postDataJSON();writes.push(p.language);assert.equal(route.request().headers().authorization,'Bearer TECH-A');
   if(holdWrite){holdWrite=false;writeStarted();await new Promise(r=>releaseWrite=r);}
   return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,language:p.language})});
  });
  await page.goto('http://language.test/test');await ready;
  await page.locator('#cwLanguageSelect').selectOption('es');await firstWrite;
  assert.equal(await page.locator('#water').textContent(),'Agua abierta');assert.equal(await page.locator('#save').textContent(),'Guardar');assert.equal(await page.locator('#reason').inputValue(),'CHEMICAL_MISSING');assert.equal(await page.locator('#reason option').textContent(),'Faltan productos químicos');
  assert.equal(await page.locator('#note').inputValue(),'Guardar');assert.equal(await page.locator('[data-cw-no-i18n]').textContent(),'Guardar');
  releaseRead();await page.waitForTimeout(250);assert.equal(await page.locator('html').getAttribute('lang'),'es');
  await page.evaluate(()=>document.querySelector('#state').firstChild.nodeValue='Concluído');await page.waitForFunction(()=>document.querySelector('#state').textContent==='Finalizado');
  await page.locator('#cwLanguageSelect').selectOption('fr');assert.deepEqual(writes,['es']);releaseWrite();await page.waitForFunction(()=>document.querySelector('#save').textContent==='Enregistrer');
  await page.waitForTimeout(200);assert.deepEqual(writes,['es','fr']);
  await page.locator('#cwLanguageSelect').selectOption('pt');assert.equal(await page.locator('#state').textContent(),'Concluído');
  // An old server reply must never write language into another account.
  await page.reload();await page.waitForFunction(()=>document.querySelector('#cwLanguageSelect'));await page.evaluate(()=>{localStorage.setItem('token','TECH-B');localStorage.setItem('cristalwater_user',JSON.stringify({id:2,role:'TECHNICIAN',language:'es'}));});releaseRead();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cristalwater_user')).language),'es');assert.deepEqual(errors,[]);
  const field=await browser.newPage({viewport:{width:320,height:844}});
  await field.addInitScript(()=>{localStorage.setItem('cw_language','es');});
  await field.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/technician-field-mode')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../frontend/technician-field-mode.html'),'utf8')});
   if(u.pathname==='/cw-i18n.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/cw-i18n.js'),'utf8')});
   return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:''});
  });
  await field.goto('http://field-language.test/technician-field-mode');await field.waitForFunction(()=>document.querySelector('#cwLanguageSelect')?.value==='es');
  assert.equal(await field.locator('#incompleteReason option[value=CHEMICAL_MISSING]').textContent(),'Faltan productos químicos');
  const bounds=await field.locator('#cwLanguageSelect').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=320);
  assert.equal(await field.locator('.top .cw-lang-switch').count(),1);await field.close();
  // A component may repaint after an actual lang change. Reapplying the same
  // language for new text must not trigger that component again or lose focus.
  const consumer=await browser.newPage();consumer.setDefaultTimeout(5000);
  await consumer.addInitScript(()=>localStorage.setItem('cw_language','en'));
  await consumer.route('**/*',route=>new URL(route.request().url()).pathname==='/cw-i18n.js'
    ?route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/cw-i18n.js'),'utf8')})
    :route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt"><meta charset="utf-8"><body><div id="consumer" data-cw-no-i18n><input id="managed" value="Original Guardar"></div><p id="fresh">Guardar</p><script src="/cw-i18n.js"></script></body></html>'}));
  await consumer.goto('http://consumer-language.test/');
  await consumer.waitForFunction(()=>document.getElementById('fresh').textContent==='Save');
  await consumer.evaluate(()=>{
    window.qaLanguageMutations=[];window.qaManaged=document.getElementById('managed');qaManaged.focus();qaManaged.setSelectionRange(2,7);
    new MutationObserver(rows=>{qaLanguageMutations.push(...rows.map(row=>({old:row.oldValue,current:document.documentElement.lang})));const input=document.createElement('input');input.id='managed';input.value=qaManaged.value;document.getElementById('consumer').replaceChildren(input);}).observe(document.documentElement,{attributes:true,attributeFilter:['lang'],attributeOldValue:true});
    document.getElementById('fresh').textContent='Concluído';
  });
  await consumer.waitForFunction(()=>document.getElementById('fresh').textContent==='Completed');
  let state=await consumer.evaluate(()=>({mutations:qaLanguageMutations,same:qaManaged===document.getElementById('managed'),focus:document.activeElement===qaManaged,selection:[qaManaged.selectionStart,qaManaged.selectionEnd]}));
  assert.deepEqual(state.mutations,[],'Automatic translation must not emit a same-language attribute mutation');assert(state.same&&state.focus);assert.deepEqual(state.selection,[2,7]);
  await consumer.locator('#cwLanguageSelect').selectOption('fr');
  await consumer.waitForFunction(()=>document.getElementById('fresh').textContent==='Termine');
  await consumer.evaluate(()=>{window.qaManaged=document.getElementById('managed');qaManaged.focus();qaManaged.setSelectionRange(2,7);document.getElementById('fresh').textContent='Água aberta';});
  await consumer.waitForFunction(()=>document.getElementById('fresh').textContent==='Eau ouverte');
  state=await consumer.evaluate(()=>({mutations:qaLanguageMutations,same:qaManaged===document.getElementById('managed'),focus:document.activeElement===qaManaged}));
  assert.deepEqual(state.mutations,[{old:'en',current:'fr'}]);assert(state.same&&state.focus);
  await consumer.evaluate(()=>CristalI18n.applyLanguage('fr'));
  assert.equal(await consumer.evaluate(()=>qaLanguageMutations.length),1);assert.equal(await consumer.locator('#managed').inputValue(),'Original Guardar');await consumer.close();
  await checkExcludedTraversal(browser);
  console.log('PASS same-language automatic/explicit updates preserve managed nodes/focus; actual language changes notify once and fresh text still translates');
  console.log('PASS Spanish field labels, stable option values, user text protection, fresh live states, ordered preference writes and delayed read after choice/account change');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CW_CHROMIUM_PATH, args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}}); page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let expectedDialog, acceptDialog = true, dialogs = 0;
    page.on('dialog', dialog => { dialogs++; if (expectedDialog) assert.equal(dialog.message(),expectedDialog); else { assert.match(dialog.message(),/versão 2/); assert.match(dialog.message(),/IVA incluído/); } return acceptDialog ? dialog.accept() : dialog.dismiss(); });
    const html = fs.readFileSync(path.join(__dirname,'../frontend/client-portal.html'),'utf8');
    const start = html.indexOf('      <section class="cw-v2-card" id="clientQuotesPanel"');
    const section = html.slice(start,html.indexOf('</section>',start)+10);
    assert(start >= 0); assert(html.includes('<script src="/client-quotes.js"></script>'));
    const quote = {id:12,repairId:1,version:2,poolName:'Piscina QA',problem:'Trocar bomba <img src=x onerror="window.injected=1">',publishedAt:'2026-09-15',validUntil:'2026-10-15',status:'PENDING',lines:[{description:'Bomba <script>window.injected=1</script>',type:'MATERIAL',quantity:1,unitPrice:100,total:100}],currency:'EUR',subtotal:100,discount:0,net:100,taxPercent:23,tax:23,total:123,terms:'Condições <img src=x onerror="window.injected=1">'};
    let decisions = 0, failure = 0, hold = false, release, responseMode = 'quote', holdDecision = false, releaseDecision, expectedReason = '';
    const requests = [], decisionBodies = [];
    await page.addInitScript(() => {localStorage.setItem('token','CLIENT-A'); localStorage.setItem('user',JSON.stringify({role:'CLIENT'}));});
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/test') return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{padding:10px;margin:0}button{max-width:100%}</style>${section}<script src="/client-quotes.js"></script>`});
      if (url.pathname === '/client-quotes.js') return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/client-quotes.js'),'utf8')});
      assert.equal(route.request().headers().authorization,'Bearer CLIENT-A');
      requests.push({path:url.pathname,method:route.request().method()});
      if (url.pathname.endsWith('/decision')) {
        decisions++; const body = route.request().postDataJSON(); assert.equal(body.confirm,true); assert(['APPROVED','DECLINED'].includes(body.decision));
        assert.deepEqual(Object.keys(body).sort(),['confirm','decision','reason']); assert.equal(body.reason,expectedReason); decisionBodies.push(body);
        if (holdDecision) await new Promise(resolve => releaseDecision = resolve);
        if (failure) return route.fulfill({status:failure,contentType:'application/json',body:JSON.stringify({ok:false,error:failure===409?'Versão alterada.':'Pedido expirou.'})});
        quote.status = body.decision;
        return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})});
      }
      if (hold) await new Promise(resolve => release = resolve);
      if (responseMode === 'server-error') return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Servidor literal <b>{error}{version}</b>'})});
      if (responseMode === 'owned-error') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false})});
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,quotes:responseMode === 'empty' ? [] : [quote]})});
    });
    await page.goto('http://clientquote.test/test?clientId=3');
    const approve = () => page.getByRole('button',{name:'Aprovar orçamento'});
    await approve().waitFor(); assert.equal(decisions,0); assert(await approve().isDisabled());
    assert.equal(await page.locator('#clientQuotesList img,#clientQuotesList script').count(),0);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    for (const width of [320,390,1280]) { await page.setViewportSize({width,height:844}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)); }
    const languages = ['pt','en','fr','es','de'], widths = [320,390,1280];
    const titles = ['Orçamentos','Quotes','Devis','Presupuestos','Angebote'], refreshLabels = ['Atualizar','Refresh','Actualiser','Actualizar','Aktualisieren'];
    const approveLabels = ['Aprovar orçamento','Approve quote','Approuver le devis','Aprobar presupuesto','Angebot genehmigen'], declineLabels = ['Recusar orçamento','Decline quote','Refuser le devis','Rechazar presupuesto','Angebot ablehnen'];
    const vatLabels = ['IVA','VAT','TVA','IVA','MwSt.'], updated = ['Orçamentos atualizados.','Quotes updated.','Devis actualisés.','Presupuestos actualizados.','Angebote aktualisiert.'];
    const empty = ['Ainda não existem orçamentos publicados.','No quotes have been published yet.','Aucun devis n’a encore été publié.','Todavía no hay presupuestos publicados.','Es wurden noch keine Angebote veröffentlicht.'];
    const loading = ['A carregar orçamentos...','Loading quotes...','Chargement des devis...','Cargando presupuestos...','Angebote werden geladen...'];
    const loadErrors = ['Não foi possível carregar.','Could not load.','Chargement impossible.','No se pudo cargar.','Laden fehlgeschlagen.'];
    const ownErrors = ['Não foi possível confirmar. Atualize os orçamentos.','Could not confirm. Refresh the quotes.','Impossible de confirmer. Actualisez les devis.','No se pudo confirmar. Actualiza los presupuestos.','Bestätigung fehlgeschlagen. Aktualisieren Sie die Angebote.'];
    const decisionErrors = ['Não foi possível confirmar a decisão.','Could not confirm the decision.','Impossible de confirmer la décision.','No se pudo confirmar la decisión.','Die Entscheidung konnte nicht bestätigt werden.'];
    const approvals = ['Aprovação registada.','Approval recorded.','Approbation enregistrée.','Aprobación registrada.','Genehmigung registriert.'], declines = ['Recusa registada.','Decline recorded.','Refus enregistré.','Rechazo registrado.','Ablehnung registriert.'];
    const preview = ['Pré-visualização administrativa.','Administrative preview.','Aperçu administratif.','Vista previa administrativa.','Administrative Vorschau.'];
    const amount = new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(123);
    const confirms = {
      APPROVED: [`Aprovar o orçamento versão 2, no total de ${amount} (IVA incluído)?`,`Approve quote version 2, totalling ${amount} (VAT included)?`,`Approuver le devis version 2, pour un total de ${amount} (TVA incluse) ?`,`¿Aprobar el presupuesto versión 2, por un total de ${amount} (IVA incluido)?`,`Angebot Version 2 mit einem Gesamtbetrag von ${amount} (inkl. MwSt.) genehmigen?`],
      DECLINED: [`Recusar o orçamento versão 2, no total de ${amount} (IVA incluído)?`,`Decline quote version 2, totalling ${amount} (VAT included)?`,`Refuser le devis version 2, pour un total de ${amount} (TVA incluse) ?`,`¿Rechazar el presupuesto versión 2, por un total de ${amount} (IVA incluido)?`,`Angebot Version 2 mit einem Gesamtbetrag von ${amount} (inkl. MwSt.) ablehnen?`],
    };
    let languageCases = 0, controls = 0;
    const reads = () => requests.filter(row=>row.method==='GET').length;
    async function language(index) {
      await page.evaluate(value=>{document.documentElement.lang=value;localStorage.setItem('cw_language',value);window.dispatchEvent(new CustomEvent('cw-language-change',{detail:{language:value}}));},languages[index]);
      await page.waitForFunction(expected=>document.getElementById('clientQuotesTitle').textContent===expected,titles[index]);
      assert.equal(await page.locator('#clientQuotesRefresh').textContent(),refreshLabels[index]);
    }
    async function matrix(check) {
      const beforeReads = reads(), beforeDecisions = decisions;
      for (const width of widths) { await page.setViewportSize({width,height:844}); for (let index=0;index<languages.length;index++) {
        await language(index); await check(index,width);
        assert.equal(reads(),beforeReads,'Quote language repaint cannot reload quotes'); assert.equal(decisions,beforeDecisions,'Quote language repaint cannot send a decision');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Exact viewport containment for every language'); languageCases++;
      } }
      await language(0);
    }
    const inputs = () => page.evaluate(()=>{const reason=document.querySelector('.cw-quote-card textarea'),checkbox=document.querySelector('.cw-quote-confirm input');return {reason:reason.value,checked:checkbox.checked,disabled:[...document.querySelectorAll('#clientQuotesPanel button,input,textarea')].map(item=>item.disabled),focus:document.activeElement===reason,selection:[reason.selectionStart,reason.selectionEnd],maxLength:reason.maxLength,rows:reason.rows};});
    await page.locator('.cw-quote-card textarea').fill('  Observação literal <b>{total}{version}</b>  ');
    await page.locator('.cw-quote-card textarea').focus(); await page.evaluate(()=>document.querySelector('.cw-quote-card textarea').setSelectionRange(2,8));
    await page.evaluate(()=>{window.qaQuoteNodes=[...document.querySelectorAll('#clientQuotesPanel h2,#clientQuotesPanel h3,#clientQuotesPanel button,#clientQuotesPanel p,#clientQuotesPanel span,#clientQuotesPanel strong,#clientQuotesPanel input,#clientQuotesPanel textarea')];window.qaQuoteLeaves=qaQuoteNodes.map(item=>item.firstChild);});
    for (const checked of [false,true]) {
      if (checked) { await page.locator('.cw-quote-confirm input').check(); await page.locator('.cw-quote-card textarea').focus(); await page.evaluate(()=>document.querySelector('.cw-quote-card textarea').setSelectionRange(2,8)); }
      const before = await inputs();
      await matrix(async (index,width)=>{
        assert.deepEqual(await inputs(),before); assert(await page.evaluate(()=>qaQuoteNodes.every((item,index)=>item.isConnected && item.firstChild===qaQuoteLeaves[index])));
        assert.equal(await page.locator('.cw-quote-actions button').nth(0).textContent(),approveLabels[index]); assert.equal(await page.locator('.cw-quote-actions button').nth(1).textContent(),declineLabels[index]);
        assert.equal(await page.locator('#clientQuotesStatus').textContent(),updated[index]);
        const consent = await page.locator('.cw-quote-confirm span').textContent(); assert(consent.includes('2') && consent.includes(amount) && consent.includes(vatLabels[index]));
        assert((await page.locator('.cw-quote-card strong').textContent()).includes(amount));
        assert((await page.locator('.cw-quote-card').textContent()).includes(quote.problem)); assert((await page.locator('.cw-quote-card').textContent()).includes(quote.terms));
        assert.equal(await page.locator('.cw-quote-card li').textContent(),`${quote.lines[0].description} — 1 × ${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(100)} = ${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(100)}`);
        assert.equal(await page.locator('#clientQuotesList img,#clientQuotesList script').count(),0);
        for (const button of await page.locator('.cw-quote-actions button').all()) { const rect=await button.boundingBox(); assert(rect.x>=0 && rect.x+rect.width<=width && rect.height>=44); }
        if (checked && index===4 && width===320 && process.env.CW_QUOTE_CAPTURE) { fs.mkdirSync(process.env.CW_QUOTE_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.CW_QUOTE_CAPTURE,'quote-de-320.png'),fullPage:true}); }
      });
    }
    await page.locator('.cw-quote-card textarea').fill(''); await page.locator('.cw-quote-confirm input').uncheck();
    // Original Portuguese decision/version/IVA cases below remain unchanged.
    await page.locator('.cw-quote-confirm input').check(); await approve().click();
    await page.waitForFunction(()=>document.getElementById('clientQuotesStatus').textContent==='Aprovação registada.');
    await page.waitForFunction(()=>!document.querySelector('.cw-quote-confirm')); assert.equal(decisions,1);
    for (const code of [409,408]) {
      quote.status='PENDING'; failure=code; await page.locator('#clientQuotesRefresh').click(); await approve().waitFor();
      await page.locator('.cw-quote-confirm input').check(); await approve().click();
      await page.waitForFunction(()=>document.getElementById('clientQuotesStatus').textContent.includes('Não foi possível confirmar'));
      assert.equal(await approve().count(),0);
    }
    assert.equal(decisions,3); failure=0;
    await page.locator('#clientQuotesRefresh').click(); await approve().waitFor();
    await page.locator('.cw-quote-confirm input').check(); await page.getByRole('button',{name:'Recusar orçamento'}).click();
    await page.waitForFunction(()=>document.getElementById('clientQuotesStatus').textContent==='Recusa registada.'); assert.equal(decisions,4);
    quote.status='PENDING';
    await page.evaluate(()=>localStorage.setItem('user',JSON.stringify({role:'ADMIN'})));
    await page.locator('#clientQuotesRefresh').click(); await page.getByText('Pré-visualização administrativa.',{exact:false}).waitFor(); assert.equal(await approve().count(),0);
    await matrix(async index=>{assert((await page.locator('#clientQuotesList').textContent()).includes(preview[index]));assert.equal(await page.locator('.cw-quote-actions button').count(),0);});
    await page.evaluate(()=>localStorage.setItem('user',JSON.stringify({role:'CLIENT'})));
    // Each state is rendered by the original GET and then repainted in place.
    const states = {
      PENDING:['Aguarda a sua decisão','Awaiting your decision','En attente de votre décision','Pendiente de tu decisión','Ihre Entscheidung steht aus'],
      APPROVED:['Aprovado','Approved','Approuvé','Aprobado','Genehmigt'],
      DECLINED:['Recusado','Declined','Refusé','Rechazado','Abgelehnt'],
      SUPERSEDED:['Substituído por outra versão','Replaced by another version','Remplacé par une autre version','Sustituido por otra versión','Durch eine andere Version ersetzt'],
      EXPIRED:['Prazo terminado','Expired','Délai expiré','Plazo vencido','Frist abgelaufen'],
      UNAVAILABLE:['Indisponível para aprovação','Unavailable for approval','Approbation indisponible','No disponible para aprobación','Nicht zur Genehmigung verfügbar'],
      FOREIGN:['Consulte a equipa','Contact the team','Contactez l’équipe','Consulta al equipo','Wenden Sie sich an das Team'],
    };
    for (const [state,labels] of Object.entries(states)) {
      quote.status=state; await page.locator('#clientQuotesRefresh').click(); await page.locator('.cw-quote-card').waitFor();
      await matrix(async index=>{assert.equal(await page.locator('.cw-quote-card .pill').textContent(),labels[index]);assert.equal(await page.locator('.cw-quote-confirm input').count(),state==='PENDING'?1:0);});
    }
    const originalPool = quote.poolName, originalPublished = quote.publishedAt, originalUntil = quote.validUntil;
    quote.status='PENDING'; quote.poolName='Dados literais {version} <b>{total}</b>'; quote.publishedAt=null;quote.validUntil=null;
    await page.locator('#clientQuotesRefresh').click(); await approve().waitFor();
    await matrix(async index=>{assert((await page.locator('.cw-quote-card h3').textContent()).startsWith(quote.poolName));assert((await page.locator('.cw-quote-card p.muted').textContent()).includes(['Sem data','No date','Sans date','Sin fecha','Kein Datum'][index]));assert.equal(await page.locator('.cw-quote-card h3 b').count(),0);});
    quote.poolName='';await page.locator('#clientQuotesRefresh').click();await approve().waitFor();
    await matrix(async index=>assert((await page.locator('.cw-quote-card h3').textContent()).startsWith(['Piscina','Pool','Piscine','Piscina','Pool'][index]+' · ')));
    quote.poolName=originalPool;quote.publishedAt=originalPublished;quote.validUntil=originalUntil;
    for (const mode of ['empty','server-error','owned-error']) {
      responseMode=mode;await page.locator('#clientQuotesRefresh').click();await page.waitForFunction(()=>!document.getElementById('clientQuotesRefresh').disabled);
      await page.evaluate(()=>{window.qaStateText=document.getElementById('clientQuotesStatus').firstChild;window.qaEmpty=document.querySelector('#clientQuotesList > p');});
      await matrix(async index=>{
        assert(await page.evaluate(()=>document.getElementById('clientQuotesStatus').firstChild===qaStateText));
        if (mode==='empty') {assert.equal(await page.locator('#clientQuotesList > p').textContent(),empty[index]);assert(await page.evaluate(()=>document.querySelector('#clientQuotesList > p')===qaEmpty));}
        else {const message=await page.locator('#clientQuotesStatus').textContent();assert(message.startsWith(loadErrors[index]));assert(message.includes(mode==='server-error'?'Servidor literal <b>{error}{version}</b>':ownErrors[index]));assert.equal(await page.locator('#clientQuotesStatus b').count(),0);}
        assert.equal(await page.locator('.cw-quote-actions button').count(),0);
      });
    }
    responseMode='quote';hold=true;await page.locator('#clientQuotesRefresh').click();await page.waitForFunction(()=>document.getElementById('clientQuotesRefresh').disabled);
    await matrix(async index=>{assert.equal(await page.locator('#clientQuotesStatus').textContent(),loading[index]);assert(await page.locator('#clientQuotesRefresh').isDisabled());assert.equal(await page.locator('#clientQuotesList').textContent(),'');});
    hold=false;release();await approve().waitFor();
    // Private ownership rejects edited leaves, replaced text nodes and clones.
    for (const mode of ['edited','new-text-node','foreign-clone']) {
      await page.evaluate(mode=>{const item=document.querySelector('.cw-quote-card h3');if(mode==='edited')item.firstChild.nodeValue='Texto literal <b>{version}</b>';else if(mode==='new-text-node')item.replaceChildren(document.createTextNode(item.textContent));else {const clone=item.cloneNode(true);clone.dataset.cwQuoteKey='quoteTitle';clone.dataset.cwI18n='quoteTitle';item.replaceWith(clone);}window.qaForeign=document.querySelector('.cw-quote-card h3');window.qaForeignBytes=qaForeign.textContent;},mode);
      await matrix(async()=>{assert(await page.evaluate(()=>document.querySelector('.cw-quote-card h3')===qaForeign && qaForeign.textContent===qaForeignBytes));});
      await page.locator('#clientQuotesRefresh').click();await approve().waitFor();controls++;
    }
    // Cancellation has no POST. A pending native handler retains its controls,
    // consent and exact payload while its own labels change language.
    for (let index=0;index<languages.length;index++) for (const decision of ['APPROVED','DECLINED']) {
      quote.status='PENDING';await language(index);await page.locator('#clientQuotesRefresh').click();await page.locator('.cw-quote-confirm input').waitFor();
      const button=page.locator('.cw-quote-actions button').nth(decision==='APPROVED'?0:1);
      await page.locator('.cw-quote-confirm input').check();await page.locator('.cw-quote-card textarea').fill('  Motivo literal <b>{total}</b>  ');expectedReason='Motivo literal <b>{total}</b>';
      expectedDialog=confirms[decision][index];acceptDialog=false;const beforeCancel=decisions;await button.click();assert.equal(decisions,beforeCancel);assert(!(await button.isDisabled()));controls++;
      acceptDialog=true;holdDecision=true;await page.evaluate(()=>{window.qaBusyNodes=[...document.querySelectorAll('#clientQuotesPanel button,input,textarea')];});
      await button.click();await page.waitForFunction(()=>[...document.querySelectorAll('#clientQuotesPanel button,input,textarea')].every(item=>item.disabled));
      const deadline=Date.now()+5000;while(!releaseDecision && Date.now()<deadline)await page.waitForTimeout(10);assert(releaseDecision);
      assert.equal(decisions,beforeCancel+1);assert.deepEqual(decisionBodies.at(-1),{decision,confirm:true,reason:expectedReason});
      const beforeBusy=await inputs();await matrix(async()=>{assert.deepEqual(await inputs(),beforeBusy);assert(await page.evaluate(()=>qaBusyNodes.every(item=>item.isConnected)));});
      holdDecision=false;releaseDecision();releaseDecision=null;
      await page.waitForFunction(()=>!document.getElementById('clientQuotesRefresh').disabled && !document.querySelector('.cw-quote-confirm input'));
      await matrix(async next=>assert.equal(await page.locator('#clientQuotesStatus').textContent(),(decision==='APPROVED'?approvals:declines)[next]));controls++;
    }
    expectedDialog=null;expectedReason='';quote.status='PENDING';failure=409;await page.locator('#clientQuotesRefresh').click();await approve().waitFor();await page.locator('.cw-quote-confirm input').check();await approve().click();
    await page.waitForFunction(()=>document.getElementById('clientQuotesStatus').textContent.includes('Não foi possível confirmar'));
    await matrix(async index=>{const message=await page.locator('#clientQuotesStatus').textContent();assert(message.startsWith(decisionErrors[index]));assert(message.includes('Versão alterada.'));assert.equal(await page.locator('.cw-quote-actions button').count(),0);});failure=0;
    await page.evaluate(()=>localStorage.setItem('user',JSON.stringify({role:'ADMIN'})));await page.locator('#clientQuotesRefresh').click();await page.getByText('Pré-visualização administrativa.',{exact:false}).waitFor();
    hold=true; await page.locator('#clientQuotesRefresh').click();
    await page.waitForTimeout(100);
    await page.evaluate(()=>{localStorage.setItem('token','CLIENT-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});
    assert.equal(await page.locator('#clientQuotesPanel').isVisible(),false); release();
    await page.waitForTimeout(150); assert.equal(await page.locator('#clientQuotesList').textContent(),''); assert.deepEqual(errors,[]);
    await page.goto('http://clientquote.test/test?clientId=0');
    await page.waitForFunction(()=>document.getElementById('clientQuotesStatus').textContent==='Escolha um cliente para consultar os orçamentos.');
    await matrix(async index=>{assert.equal(await page.locator('#clientQuotesStatus').textContent(),['Escolha um cliente para consultar os orçamentos.','Select a client to view quotes.','Sélectionnez un client pour consulter les devis.','Selecciona un cliente para consultar los presupuestos.','Wählen Sie einen Kunden, um die Angebote anzuzeigen.'][index]);assert.equal(await page.locator('#clientQuotesList').textContent(),'');});
    assert.deepEqual(errors,[]);
    console.log('PASS client quote explicit version/IVA confirmation, approval and refusal, 409/408 no false success, admin preview, XSS, responsive widths and delayed account response');
    assert.equal(decisions,15);assert.equal(dialogs,25);
    console.log('PASS quote languages '+JSON.stringify({languageCases,languages,widths,controls,decisions,dialogs,originalInputsConsentFocusSelectionAndHandlers:true,languagePaintNoReadsOrDecisions:true,literalDataAndErrorOwnership:true,allOriginalCasesRetained:true}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

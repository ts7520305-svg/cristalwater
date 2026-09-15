const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CW_CHROMIUM_PATH, args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}}); page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { assert.match(dialog.message(),/versão 2/); assert.match(dialog.message(),/IVA incluído/); return dialog.accept(); });
    const html = fs.readFileSync(path.join(__dirname,'../frontend/client-portal.html'),'utf8');
    const start = html.indexOf('      <section class="cw-v2-card" id="clientQuotesPanel"');
    const section = html.slice(start,html.indexOf('</section>',start)+10);
    assert(start >= 0); assert(html.includes('<script src="/client-quotes.js"></script>'));
    const quote = {id:12,repairId:1,version:2,poolName:'Piscina QA',problem:'Trocar bomba <img src=x onerror="window.injected=1">',publishedAt:'2026-09-15',validUntil:'2026-10-15',status:'PENDING',lines:[{description:'Bomba <script>window.injected=1</script>',type:'MATERIAL',quantity:1,unitPrice:100,total:100}],currency:'EUR',subtotal:100,discount:0,net:100,taxPercent:23,tax:23,total:123,terms:'Condições <img src=x onerror="window.injected=1">'};
    let decisions = 0, failure = 0, hold = false, release;
    await page.addInitScript(() => {localStorage.setItem('token','CLIENT-A'); localStorage.setItem('user',JSON.stringify({role:'CLIENT'}));});
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/test') return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{padding:10px;margin:0}button{max-width:100%}</style>${section}<script src="/client-quotes.js"></script>`});
      if (url.pathname === '/client-quotes.js') return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/client-quotes.js'),'utf8')});
      assert.equal(route.request().headers().authorization,'Bearer CLIENT-A');
      if (url.pathname.endsWith('/decision')) {
        decisions++; const body = route.request().postDataJSON(); assert.equal(body.confirm,true); assert(['APPROVED','DECLINED'].includes(body.decision));
        if (failure) return route.fulfill({status:failure,contentType:'application/json',body:JSON.stringify({ok:false,error:failure===409?'Versão alterada.':'Pedido expirou.'})});
        quote.status = body.decision;
        return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})});
      }
      if (hold) await new Promise(resolve => release = resolve);
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,quotes:[quote]})});
    });
    await page.goto('http://clientquote.test/test?clientId=3');
    const approve = () => page.getByRole('button',{name:'Aprovar orçamento'});
    await approve().waitFor(); assert.equal(decisions,0); assert(await approve().isDisabled());
    assert.equal(await page.locator('#clientQuotesList img,#clientQuotesList script').count(),0);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    for (const width of [320,390,1280]) { await page.setViewportSize({width,height:844}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)); }
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
    hold=true; await page.locator('#clientQuotesRefresh').click();
    await page.waitForTimeout(100);
    await page.evaluate(()=>{localStorage.setItem('token','CLIENT-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});
    assert.equal(await page.locator('#clientQuotesPanel').isVisible(),false); release();
    await page.waitForTimeout(150); assert.equal(await page.locator('#clientQuotesList').textContent(),''); assert.deepEqual(errors,[]);
    console.log('PASS client quote explicit version/IVA confirmation, approval and refusal, 409/408 no false success, admin preview, XSS, responsive widths and delayed account response');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

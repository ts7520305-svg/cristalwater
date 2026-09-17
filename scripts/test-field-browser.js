/* Real Chromium component regression. API responses are controlled test fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const sources = ['cw-field-write-store.js','cw-field-reminders.js','crystal-os-v2-shell.js'].map(name=>fs.readFileSync(path.join(__dirname,'../frontend',name),'utf8'));
const source = sources.join('\n');
const {hash}=require('../src/services/fieldWriteRequestService');
const html = `<meta charset="utf-8"><body><div id="nextTitle">Piscina de ensaio</div><div id="nextMeta">Cliente de ensaio</div><div id="accessList">Fechar o portão. Confirmar válvulas.</div><div class="water-card"><div class="muted"></div><div class="water-grid"><input id="waterMinutes"><input id="waterCloseTime"><input id="waterNote"></div></div><div id="toast"></div><button id="openWaterBtn">Água aberta</button><button id="startBtn">Iniciar visita</button><div id="waterReminderList"></div></body>`;
const deadline = setTimeout(() => { console.error('FAIL: browser did not remain responsive'); process.exit(1); }, 25000);
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    page.on('pageerror', e => console.error('PAGE', e.message));
    let mode = 'queued', saved;
    const localKey='cwFieldReminders:v1:TECH:41';
    const requests = [];
    await page.route('http://127.0.0.1:59998/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        requests.push({ method: route.request().method(), path: url.pathname, body: route.request().postDataJSON() });
        if(route.request().method()==='GET')return route.fulfill({json:{ok:true,reminders:saved&&url.pathname.includes('water-reminders')?[saved]:[]}});
        if(mode==='queued')return route.fulfill({status:202,json:{ok:true,offline:true,status:'PENDING_SYNC'}});
        if(url.pathname.endsWith('/water-reminders')){const body=route.request().postDataJSON(),{owner,localId,...payload}=body;saved={id:7,sourceKey:`water:${owner}:${localId}`,assignedToTechnicianId:41,poolId:9,clientId:3,isCompleted:false,dueDate:body.dueAt,createdAt:body.openedAt,metadata:{...body,kind:'WATER_OPEN',payloadHash:hash({kind:'WATER_OPEN',...payload})}};}
        if(url.pathname.endsWith('/close'))saved.isCompleted=true;
        return route.fulfill({json:{ok:true,reminder:saved}});
      }
      return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/html', body: url.pathname.endsWith('.js') ? '' : html });
    });
    await page.goto('http://127.0.0.1:59998/technician-field-mode');
    await page.evaluate(() => {
      localStorage.setItem('cwTechnicianId', '41');
      localStorage.setItem('cw:tech-field:ui-state:v1', JSON.stringify({ selectedVisitId: '5' }));
      const token='qa.'+btoa(JSON.stringify({id:41,role:'TECHNICIAN'}))+'.qa';
      localStorage.setItem('token',token);
      window.CristalAuth = { getToken:()=>token, parseUser: () => ({ id: 41, name: 'Técnico QA' }) };
      window.CWFieldVisitContext=()=>({id:5,visitType:'REGULAR',poolId:9,clientId:3,poolName:'Piscina de ensaio'});
      window.CWV2StateAdapter = { start() {} };
      window.starts = 0;
      document.querySelector('#startBtn').addEventListener('click', () => window.starts++);
    });
    await page.evaluate(() => { const node=document.createElement('div'); node.className='loading'; node.textContent='A carregar'; document.body.appendChild(node); });
    await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../frontend/ui/state-adapter-v2.js'),'utf8')});
    await page.addScriptTag({ content: source });
    assert.equal(await page.evaluate(() => new Promise(r => setTimeout(() => r('responsive'), 50))), 'responsive');
    await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
    assert.equal(await page.evaluate(() => window.starts), 0);
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    await page.getByRole('button', { name: 'Li e vou iniciar a visita' }).click();
    assert.equal(await page.evaluate(() => window.starts), 1);
    assert.ok(await page.evaluate(() => sessionStorage.getItem('cw:field:checkin:5')));
    console.log('PASS responsive mobile field screen and explicit check-in');

    // A 202 from the service worker is queued locally, not acknowledged by the server.
    await page.getByRole('button', { name: 'Água aberta', exact: true }).click();
    await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('cwFieldReminders:v1:TECH:41') || '{}')).some(r => r.syncError));
    const pending = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('cwFieldReminders:v1:TECH:41')))[0]);
    assert.equal(pending.serverId == null, true);
    assert.ok(pending.syncError);
    console.log('PASS offline acknowledgement remains pending');

    // A close made offline without a server id must sync creation before closure.
    await page.waitForTimeout(200);
    mode = 'online'; requests.length = 0;
    await page.evaluate(async (item) => {
      await CWFieldReminders.mark('WATER_OPEN',item.localId,'close');
      await CWFieldReminders.sync();
    }, pending);
    await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('cwFieldReminders:v1:TECH:41')))[0].closeSyncedAt);
    assert.deepEqual(requests.filter(r => r.method === 'POST').map(r => r.path), ['/api/technician/water-reminders', '/api/technician/water-reminders/7/close']);
    const closed = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('cwFieldReminders:v1:TECH:41')))[0]);
    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.syncError, '');
    console.log('PASS offline close is replayed after creation');
  } finally { await browser.close(); }
})().then(() => { clearTimeout(deadline); console.log('RESULT=PASS'); }).catch(error => { clearTimeout(deadline); console.error(error); process.exitCode = 1; });

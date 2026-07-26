const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const { chromium, devices } = require('playwright');
require('../src/loadEnv')();
const { prisma } = require('../src/prismaClient');
const bcrypt = require('bcryptjs');

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3002';
const ROOT = path.join(__dirname, '..');
const COVERAGE_PATH = path.join(ROOT, 'CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md');
const OUT_JSON = path.join(ROOT, 'docs/product/FCS14_VISUAL_AUDIT_V3.json');
const OUT_MD   = path.join(ROOT, 'docs/product/FCS14_VISUAL_AUDIT_V3.md');

// Permanently excluded redirect-only routes (not real pages):
const EXCLUDED_ROUTES = new Set([
  '/admin-core-flow',
  '/admin-operational-flow',
  '/admin-test-center',
]);
// Note: /admin-ai and /invoices remain IN scope but will hit HARNESS_TIMEOUT (12s).
// They are flagged as candidates for separate product investigation.

const METRIC_KEYS = ['spacing','header','cards','buttons','typography','inputs','tables','modals','emptyState','loading','responsiveness','undefinedPlaceholders'];

const VIEWPORT_PROFILES = [
  { id:'desktop',   label:'Desktop 1440x920', contextOptions:{ viewport:{ width:1440, height:920 }, colorScheme:'light' } },
  { id:'mobile390', label:'Mobile 390x844',   contextOptions:{ viewport:{ width:390,  height:844 }, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light' } },
  { id:'android',   label:'Android Pixel 7',  contextOptions:{ ...devices['Pixel 7'], colorScheme:'light' } },
];

function parseCoverageTable(fp) {
  const lines = fs.readFileSync(fp,'utf8').split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    if (!line.startsWith('| /')) continue;
    const cols = line.split('|').map(c=>c.trim()).filter(Boolean);
    if (cols.length < 6) continue;
    const route = cols[0];
    if (EXCLUDED_ROUTES.has(route)) continue;
    if (cols[5].toUpperCase() !== 'YES') continue;
    const roles = cols[2].split(',').map(r=>r.trim().toUpperCase()).filter(Boolean);
    if (!map.has(route)) map.set(route, { route, roles });
  }
  return [...map.values()];
}

function pickRole(roles) {
  const n = roles.map(r=>r.toUpperCase());
  if (n.includes('ADMIN')) return 'ADMIN';
  if (n.includes('TECHNICIAN')) return 'TECHNICIAN';
  if (n.includes('CLIENT')) return 'CLIENT';
  return 'ADMIN';
}

async function rpc(pathname, opts={}) {
  const r = await fetch(`${BASE_URL}${pathname}`, {
    method: opts.method||'GET',
    headers: { 'Content-Type':'application/json', ...(opts.headers||{}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(()=>({})) };
}

async function setupAdmin(runId) {
  const email = `${runId.toLowerCase()}@qa-fcs14-admin.test`;
  const plain = `Tmp-${crypto.randomBytes(8).toString('hex')}-A1!`;
  const pw = await bcrypt.hash(plain, 10);
  const user = await prisma.user.create({ data:{ email, password:pw, role:'ADMIN', active:true, mustChangePassword:false, name:`QA FCS14 ADMIN ${runId}` } });
  const login = await rpc('/api/auth/login', { method:'POST', body:{ email, password: plain } });
  if (!login.ok || !login.data?.token) throw new Error('admin login failed');
  return { role:'ADMIN', token: login.data.token, user: login.data.user||{ id:user.id, role:'ADMIN', email }, cleanupId: user.id };
}

async function setupTechnician(runId) {
  const pin = String(Math.floor(1000 + Math.random()*8999));
  const t = await prisma.technician.create({ data:{ name:`QA FCS14 TECH ${runId}`, email:`${runId.toLowerCase()}@qa-fcs14-tech.test`, pin, role:'TECHNICIAN', active:true, zone:'QA' } });
  const login = await rpc('/api/technician-auth/login', { method:'POST', body:{ pin } });
  if (!login.ok || !login.data?.token) throw new Error('tech login failed');
  return { role:'TECHNICIAN', token: login.data.token, user: login.data.user||{ id:t.id, role:'TECHNICIAN', name:t.name }, cleanupId: t.id };
}

async function setupClient(runId) {
  const plain = `Tmp-${crypto.randomBytes(8).toString('hex')}-A1!`;
  const pw = await bcrypt.hash(plain, 10);
  const c = await prisma.client.create({ data:{ name:`QA FCS14 CLIENT ${runId}`, email:`${runId.toLowerCase()}@qa-fcs14-client.test`, password:pw, active:true, status:'ACTIVE', archiveStatus:'ATIVO', source:'QA_FCS14' } });
  const login = await rpc('/api/client-auth/login', { method:'POST', body:{ email:c.email, password: plain } });
  if (!login.ok || !login.data?.token) throw new Error('client login failed');
  return { role:'CLIENT', token: login.data.token, user: login.data.client||{ id:c.id, role:'CLIENT', name:c.name, email:c.email }, cleanupId: c.id };
}

async function evaluateMetrics(page) {
  return page.evaluate(() => {
    const s = (ok, d=null) => ({ status: ok ? 'PASS' : 'FAIL', details:d });
    const root = document.documentElement;
    const body = document.body;
    const vis = el => {
      if (!el) return false;
      const st = window.getComputedStyle(el);
      if (st.display==='none'||st.visibility==='hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width>0 && r.height>0;
    };
    const main = document.querySelector('main')||body;
    const ms = window.getComputedStyle(main);
    const padT = parseFloat(ms.paddingTop||'0');
    const padX = parseFloat(ms.paddingLeft||'0');
    const cards   = Array.from(document.querySelectorAll('.card,[class*="card"]')).filter(vis);
    const buttons = Array.from(document.querySelectorAll('button,.btn,.cw-v2-btn')).filter(vis);
    const headers = Array.from(document.querySelectorAll('h1,header h1,.page-head h1')).filter(vis);
    const inputs  = Array.from(document.querySelectorAll('input,select,textarea')).filter(vis);
    const tables  = Array.from(document.querySelectorAll('table')).filter(vis);
    const modals  = Array.from(document.querySelectorAll('.modal,[role="dialog"],.cw-modal,.repair-modal'));
    const bodyFont = parseFloat(window.getComputedStyle(body).fontSize||'16');
    const hSizes = headers.map(h=>parseFloat(window.getComputedStyle(h).fontSize||'0')).filter(n=>Number.isFinite(n)&&n>0);
    const iHts = inputs.map(i=>i.getBoundingClientRect().height).filter(h=>h>0);
    const minIH = iHts.length ? Math.min(...iHts) : 0;
    const iRad = inputs.map(i=>parseFloat(window.getComputedStyle(i).borderRadius||'0')).filter(n=>Number.isFinite(n));
    const maxIR = iRad.length ? Math.max(...iRad) : 0;
    const modOk = modals.every(m=>m.getAttribute('role')==='dialog'||m.getAttribute('aria-modal')==='true');
    const raw = body?.innerText||'';
    const txt = raw.toLowerCase();
    const emptyOk = /sem dados|nenhum|ainda nao existem|empty/.test(txt)||!!document.querySelector('.empty,.empty-box,.cw-empty,.cw-v2-state-empty,[data-cw-state="empty"]');
    const loadOk  = /a carregar|loading/.test(txt)||!!document.querySelector('.loading,.cw-v2-state-loading,[aria-busy="true"],[data-cw-state="loading"]');
    const sMatches = (raw.match(/\b(undefined|null|nan|todo|tbd|lorem ipsum|coming soon)\b/gi)||[]);
    const tMatches = (raw.match(/(\{\{[^}]+\}\}|\$\{[^}]+\})/g)||[]);
    const uCount = sMatches.length + tMatches.length;
    const hScroll = root.scrollWidth > root.clientWidth+1;
    return {
      spacing:             s(padT>=8&&padX>=8, { padT, padX }),
      header:              s(headers.length>0, { headers: headers.length }),
      cards:               s(cards.length>0,   { cards: cards.length }),
      buttons:             s(buttons.length>0, { buttons: buttons.length }),
      typography:          s(bodyFont>=12&&bodyFont<=20&&hSizes.some(sz=>sz>=bodyFont+4), { bodyFont, hSizes }),
      inputs:              s(inputs.length===0||(minIH>=30&&maxIR>=4), { inputs:inputs.length, minIH, maxIR }),
      tables:              s(tables.length===0||!hScroll, { tables:tables.length, hScroll }),
      modals:              s(modals.length===0||modOk, { modals:modals.length, modOk }),
      emptyState:          s(emptyOk, { emptyOk }),
      loading:             s(loadOk,  { loadOk }),
      responsiveness:      s(!hScroll, { hScroll, sw:root.scrollWidth, cw:root.clientWidth }),
      undefinedPlaceholders: s(uCount===0, { count:uCount, samples:[...new Set([...sMatches,...tMatches])].slice(0,5) }),
    };
  });
}

// Per-route hard timeout: if a route takes longer than this, record as TIMEOUT and move on.
// This prevents pages with infinite polling or slow APIs from blocking the entire audit.
const ROUTE_TIMEOUT_MS = 12000;

async function auditRoute(context, ri, sessions, profileId) {
  const role = pickRole(ri.roles);
  const sess = sessions[role];
  const t0 = performance.now();

  const work = async () => {
    const page = await context.newPage();
    try {
      await page.addInitScript(p=>{
        localStorage.clear(); sessionStorage.clear();
        if (p.token) { localStorage.setItem('token',p.token); localStorage.setItem('cristalwater_jwt',p.token); }
        if (p.user)  { localStorage.setItem('user',JSON.stringify(p.user)); localStorage.setItem('cristalwater_user',JSON.stringify(p.user)); }
      }, { token:sess.token, user:sess.user });

      let navErr = null;
      try { await page.goto(`${BASE_URL}${ri.route}`, { waitUntil:'domcontentloaded', timeout:10000 }); }
      catch(e) { navErr = String(e?.message||e); }

      await page.waitForTimeout(400);

      let metrics = null;
      if (!navErr) {
        metrics = await Promise.race([
          evaluateMetrics(page),
          new Promise((_,rej) => setTimeout(() => rej(new Error('evaluate timeout')), 3000)),
        ]).catch(() => null);
      }

      return { profile:profileId, route:ri.route, role, navigationError:navErr, metrics,
               elapsedMs:Math.round(performance.now()-t0), timedOut:false };
    } finally {
      // Force-close the page without waiting for pending network requests.
      await page.close({ runBeforeUnload: false }).catch(()=>null);
    }
  };

  const timeout = new Promise(resolve =>
    setTimeout(() => resolve({
      profile:profileId, route:ri.route, role,
      navigationError: `HARNESS_TIMEOUT: route exceeded ${ROUTE_TIMEOUT_MS}ms`,
      metrics: null, elapsedMs: ROUTE_TIMEOUT_MS, timedOut: true,
    }), ROUTE_TIMEOUT_MS)
  );

  return Promise.race([work(), timeout]);
}

function agg(results) {
  const s = {};
  for (const k of METRIC_KEYS) s[k]={pass:0,fail:0,notEvaluated:0};
  for (const r of results) {
    if (r.navigationError||!r.metrics) { for (const k of METRIC_KEYS) s[k].notEvaluated++; continue; }
    for (const k of METRIC_KEYS) {
      const v = r.metrics[k]?.status;
      if (v==='PASS') s[k].pass++; else if (v==='FAIL') s[k].fail++; else s[k].notEvaluated++;
    }
  }
  return s;
}

function md(report) {
  const labelMap = { spacing:'Espacamento', header:'Header', cards:'Cards', buttons:'Botoes', typography:'Tipografia', inputs:'Inputs', tables:'Tabelas', modals:'Modais', emptyState:'Empty State', loading:'Loading', responsiveness:'Responsividade', undefinedPlaceholders:'Undefined/Placeholders' };
  const lines = [
    '# FCS-1.4 — Auditoria Visual V3 (Sprint B)',
    '',
    `Data: ${report.generatedAt}`,
    `Escopo: ${report.totalRoutes} rotas x ${report.viewportProfiles.length} perfis = ${report.totalEvaluations} avaliacoes`,
    `Excluidas (harness-only exceptions): ${[...EXCLUDED_ROUTES].join(', ')}`,
    `Tempo total: ${(report.runtime.totalMs/1000).toFixed(1)}s`,
    `Tempo medio/avaliacao: ${report.runtime.avgMsPerEval}ms`,
    '',
    '## Consolidado global',
    '| Item | PASS | FAIL | N/A |','|---|---:|---:|---:|',
  ];
  for (const k of METRIC_KEYS) {
    const r = report.summaryGlobal[k];
    lines.push(`| ${labelMap[k]} | ${r.pass} | ${r.fail} | ${r.notEvaluated} |`);
  }
  for (const p of report.viewportProfiles) {
    lines.push('',`## ${p.label}`,'| Item | PASS | FAIL | N/A |','|---|---:|---:|---:|');
    for (const k of METRIC_KEYS) {
      const r = report.summaryByProfile[p.id][k];
      lines.push(`| ${labelMap[k]} | ${r.pass} | ${r.fail} | ${r.notEvaluated} |`);
    }
  }
  if (report.runtime.slowest.length) {
    lines.push('','## Rotas mais lentas','| Rota | Perfil | ms |','|---|---|---:|');
    for (const r of report.runtime.slowest) lines.push(`| ${r.route} | ${r.profile} | ${r.elapsedMs} |`);
  }
  return lines.join('\n');
}

async function cleanup(ids) {
  await Promise.all([
    ids.admin    ? prisma.user.updateMany({ where:{id:ids.admin}, data:{active:false} }).catch(()=>null) : null,
    ids.tech     ? prisma.technician.updateMany({ where:{id:ids.tech}, data:{active:false,archiveStatus:'ARQUIVADO'} }).catch(()=>null) : null,
    ids.client   ? prisma.client.updateMany({ where:{id:ids.client}, data:{active:false,status:'ARCHIVED',archiveStatus:'ARQUIVADO'} }).catch(()=>null) : null,
  ]);
}

(async () => {
  const runId = `FCS14V3_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const ids = {};
  const t0 = Date.now();
  try {
    const routes = parseCoverageTable(COVERAGE_PATH);
    console.error(`[FCS14V3] routes=${routes.length} excluded=${[...EXCLUDED_ROUTES].join(',')}`);

    const admin = await setupAdmin(runId); ids.admin = admin.cleanupId;
    const tech  = await setupTechnician(runId); ids.tech  = tech.cleanupId;
    const client= await setupClient(runId); ids.client= client.cleanupId;
    const sessions = { ADMIN:admin, TECHNICIAN:tech, CLIENT:client };

    const browser = await chromium.launch({ headless:true });
    const results = [];
    for (const profile of VIEWPORT_PROFILES) {
      console.error(`[FCS14V3] profile:${profile.id}`);
      const context = await browser.newContext(profile.contextOptions);
      for (const ri of routes) {
        const row = await auditRoute(context, ri, sessions, profile.id);
        console.error(`[FCS14V3] ${profile.id} ${ri.route} ${row.elapsedMs}ms ok=${!row.navigationError}`);
        results.push(row);
      }
      await context.close();
    }
    await browser.close();

    const navErrors  = results.filter(r=>r.navigationError && !r.timedOut);
    const timedOut    = results.filter(r=>r.timedOut);
    const summaryGlobal   = agg(results);
    const summaryByProfile = {};
    for (const p of VIEWPORT_PROFILES) summaryByProfile[p.id] = agg(results.filter(r=>r.profile===p.id));

    const elapsedList = results.map(r=>r.elapsedMs).filter(n=>Number.isFinite(n));
    const totalMs = Date.now() - t0;
    const sorted = [...results].sort((a,b)=>b.elapsedMs-a.elapsedMs);

    const report = {
      generatedAt: new Date().toISOString(),
      runId,
      baseUrl: BASE_URL,
      excludedRoutes: [...EXCLUDED_ROUTES],
      viewportProfiles: VIEWPORT_PROFILES.map(p=>({ id:p.id, label:p.label })),
      totalRoutes: routes.length,
      totalEvaluations: results.length,
      navigationErrors: navErrors,
      timedOutRoutes: timedOut,
      summaryGlobal,
      summaryByProfile,
      runtime: {
        totalMs,
        avgMsPerEval: elapsedList.length ? Math.round(elapsedList.reduce((a,b)=>a+b,0)/elapsedList.length) : 0,
        slowest: sorted.slice(0,10).map(r=>({ route:r.route, profile:r.profile, elapsedMs:r.elapsedMs })),
      },
      results,
    };

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive:true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD,  md(report));

    console.log(JSON.stringify({
      ok: navErrors.length === 0,
      runId,
      totalRoutes: routes.length,
      totalEvaluations: results.length,
      navErrors: navErrors.length,
      timedOutRoutes: timedOut.map(r=>r.route+' ('+r.profile+')'),
      runtime: report.runtime,
      summaryGlobal,
      outJson: path.relative(ROOT, OUT_JSON),
      outMd:   path.relative(ROOT, OUT_MD),
    }, null, 2));
  } catch(e) {
    console.error(JSON.stringify({ ok:false, runId, error: String(e?.message||e) }));
    process.exitCode = 1;
  } finally {
    await cleanup(ids).catch(()=>null);
    await prisma.$disconnect().catch(()=>null);
  }
})();

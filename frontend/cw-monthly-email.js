(function () {
  'use strict';
  const el = id => document.getElementById(id), root = el('mailPanel');
  if (!root) return;
  const month = el('reportMonth'), mode = el('reportMode'), status = el('mailStatus'), list = el('mailList');
  const keys = ['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
  const decode = token => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')), x => x.charCodeAt(0))));
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const validMonth = value => /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
  const outcomes = { SENT:'Aceite pelo serviço de email; entrega não confirmada.', FAILED:'Destinatário recusado. É necessária revisão antes de qualquer novo contacto.', UNKNOWN:'Resultado incerto. Rever antes de qualquer novo contacto.', PENDING:'Envio reservado; resultado por confirmar. Consulte novamente, sem repetir o envio.' };
  const reasons = { CLIENT_UNAVAILABLE:'Cliente indisponível.', RECIPIENT_MISSING_OR_INVALID:'Email ausente ou inválido.', REPORT_REQUIRES_REVIEW:'O relatório precisa de revisão.', REPORT_PERIOD_MISMATCH:'O período guardado não corresponde ao mês escolhido.' };
  const blockedText = { RULE_DISABLED:'O envio de relatórios está desativado nas regras de notificação.', EMAIL_DISABLED:'O envio de email está desativado. Pode consultar e gerar relatórios.', LEGACY_REVIEW_REQUIRED:'Há registos antigos de envio deste mês sem ligação a um relatório. É necessária revisão do histórico.' };
  let principal, invalid = false, generation = 0, busy = false, data = null, page = 0, observed = '', notice = '';
  const requests = new Set();
  try {
    const token = keys.slice(0,3).map(key=>localStorage.getItem(key)).find(Boolean), claims = decode(token);
    const userId = Number(claims.userId || claims.id), users = keys.slice(3).map(key=>localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
    if (claims.role !== 'ADMIN' || !validId(userId) || !Number.isFinite(claims.exp) || claims.exp*1000 <= Date.now() || !users.length || users.some(user=>user.role!=='ADMIN'||Number(user.userId||user.id)!==userId) || keys.slice(0,3).some(key=>localStorage.getItem(key)&&localStorage.getItem(key)!==token)) throw Error('session');
    principal = { token, userId, identity:fingerprint(), expires:claims.exp*1000 };
  } catch (_) { invalid = true; }
  const selection = () => month.value + ':' + mode.value;
  function state(kind, text) { status.dataset.state = kind; status.textContent = text; }
  function stop() { generation++; for (const request of requests) request.abort(); requests.clear(); busy=false; }
  function controls() {
    const disabled = invalid || busy || !validMonth(month.value) || !navigator.onLine;
    el('mailLoad').disabled=disabled;
    el('mailPrepare').disabled=disabled || month.value >= new Date().toISOString().slice(0,7);
    el('mailPrevious').disabled=disabled || page===0;
    el('mailNext').disabled=disabled || !data || (page+1)*6>=data.rows.length;
    root.setAttribute('aria-busy',String(busy));
    for (const node of list.querySelectorAll('button,input')) node.disabled=disabled || node.dataset.unavailable==='true' || node.tagName==='BUTTON' && !node.closest('article').querySelector('input')?.checked;
  }
  function active() {
    try { if (!invalid && principal.identity===fingerprint() && principal.expires>Date.now()) return true; } catch (_) {}
    invalid=true;stop();data=null;list.replaceChildren();el('mailPaging').hidden=true;
    state('session','A sessão mudou. Reabra a página com a conta pretendida.');controls();return false;
  }
  function changed() {
    stop();data=null;page=0;notice='';list.replaceChildren();el('mailPaging').hidden=true;observed=selection();root.hidden=mode.value!=='overview';
    if(active())state('idle','Escolha o mês acima e consulte os relatórios dos clientes.');controls();
  }
  function node(parent, tag, text, className) { const out=document.createElement(tag);out.textContent=text;if(className)out.className=className;parent.append(out);return out; }
  function validate(body, selected) {
    const fail=()=>{throw Error('A resposta não confirma este mês e os respetivos relatórios. Consulte novamente.');};
    if(body?.ok!==true||body.version!==1||body.monthRef!==selected||body.deliveryConfirmed!==false||body.blocked!==null&&!blockedText[body.blocked]||!Array.isArray(body.rows)||!Array.isArray(body.skipped)||!Array.isArray(body.deliveries))fail();
    if(new Set(body.rows.map(r=>r.reportId)).size!==body.rows.length||new Set(body.deliveries.map(r=>r.reportId)).size!==body.deliveries.length)fail();
    for(const d of body.deliveries)if(!validId(d.reportId)||!outcomes[d.status]||typeof d.recipient!=='string'||typeof d.requestId!=='string'||!Number.isFinite(Date.parse(d.createdAt))||!Number.isFinite(Date.parse(d.updatedAt)))fail();
    for(const row of body.rows){
      if(!validId(row.reportId)||!validId(row.clientId)||!['clientName','to','subject','text'].every(key=>typeof row[key]==='string')||!row.subject.endsWith(selected)||!row.text.includes('Mês: '+selected))fail();
      const saved=body.deliveries.find(d=>d.reportId===row.reportId);
      if(saved){if(JSON.stringify(saved)!==JSON.stringify(row.delivery)||row.reviewToken!==null)fail();}
      else if(row.reviewed===true){if(row.delivery!==null||row.reviewToken!==null)fail();}
      else {
        if(row.delivery!==null||typeof row.reviewToken!=='string')fail();
        let review;try{review=decode(row.reviewToken);}catch(_){fail();}
        if(review.purpose!=='MONTHLY_REPORT_REVIEW'||review.userId!==principal.userId||review.reportId!==row.reportId||review.monthRef!==selected||review.recipient!==row.to||typeof review.contentHash!=='string'||!Number.isFinite(review.exp)||review.exp*1000<=Date.now())fail();
      }
    }
    for(const row of body.skipped)if(!validId(row.reportId)||typeof row.clientName!=='string'||!reasons[row.reason])fail();
    return body;
  }
  function render() {
    list.replaceChildren();if(!data){controls();return;}
    for(const row of data.rows.slice(page*6,(page+1)*6)){
      const card=node(list,'article','', 'mail-card');card.dataset.reportId=row.reportId;
      node(card,'h3',row.clientName);node(card,'p','Mês: '+data.monthRef+' · Relatório #'+row.reportId);
      node(card,'p','Destinatário: '+row.to);node(card,'p','Assunto: '+row.subject);node(card,'pre',row.text);
      if(row.delivery){node(card,'p',outcomes[row.delivery.status]);if(row.delivery.recipient!==row.to)node(card,'p','Destinatário do envio registado: '+row.delivery.recipient);}
      else if(row.reviewed===true){node(card,'p','Existe uma revisão do envio. Consulte o histórico antes de qualquer novo contacto.');}
      else{
        const label=node(card,'label','', 'mail-confirm'),check=document.createElement('input');check.type='checkbox';check.dataset.unavailable=String(!!data.blocked);label.append(check);node(label,'span','Confirmei o mês, o destinatário e o texto deste relatório.');
        const send=node(card,'button','Confirmar envio','btn');send.type='button';send.dataset.unavailable=String(!!data.blocked);check.addEventListener('change',controls);send.addEventListener('click',()=>{if(check.checked)void sendOne(row);});
      }
    }
    if(!data.rows.length)node(list,'p','Não há relatórios disponíveis para enviar neste mês.');
    if(data.skipped.length){node(list,'h3','Relatórios que precisam de revisão');for(const row of data.skipped)node(list,'p',row.clientName+' · #'+row.reportId+' · '+reasons[row.reason]);}
    for(const delivery of data.deliveries.filter(d=>!data.rows.some(r=>r.reportId===d.reportId)))node(list,'p','Relatório #'+delivery.reportId+' · '+delivery.recipient+' · '+outcomes[delivery.status]);
    el('mailPaging').hidden=data.rows.length<=6;el('mailPage').textContent=(page+1)+' / '+Math.max(1,Math.ceil(data.rows.length/6));
    state(data.blocked?'blocked':'ready',(notice?notice+' ':'')+(data.blocked?blockedText[data.blocked]:'Mês '+data.monthRef+' · '+data.rows.length+' relatórios disponíveis para consulta.'));
    controls();
  }
  async function request(path, body, current) {
    const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch('/api/admin/reports/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+principal.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',redirect:'error'});
      if(!active()||current!==generation||observed!==selection())throw Error('Seleção alterada.');
      if((response.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')throw Error('Resposta indisponível. Consulte novamente.');
      const result=await response.json();
      if(response.status!==200||result?.ok!==true)throw Error(result?.error||'Não foi possível confirmar a operação.');
      return result;
    } finally {clearTimeout(timer);requests.delete(controller);}
  }
  async function load(keepNotice=false) {
    if(!active()||busy)return;
    stop();data=null;page=0;if(!keepNotice)notice='';list.replaceChildren();el('mailPaging').hidden=true;observed=selection();
    if(!validMonth(month.value)){state('error','Escolha um mês válido.');controls();return;}
    busy=true;controls();state('loading','A consultar relatórios e resultados de envio…');const current=generation,selected=month.value;
    try{const body=await request('email-preview?'+new URLSearchParams({monthRef:selected}),null,current);if(active()&&current===generation&&observed===selection()){data=validate(body,selected);busy=false;render();}}
    catch(error){if(active()&&current===generation){busy=false;state('error',error.name==='AbortError'?'A consulta demorou demasiado. Tente novamente.':error.message);controls();}}
  }
  async function prepare() {
    if(!active()||busy||!validMonth(month.value)||month.value>=new Date().toISOString().slice(0,7))return;
    stop();data=null;list.replaceChildren();el('mailPaging').hidden=true;observed=selection();busy=true;controls();state('loading','A guardar os relatórios em falta. Nenhum email será enviado.');const current=generation,selected=month.value;
    try{const result=await request('prepare',{monthRef:selected},current);if(result.monthRef!==selected||result.prepared!==true||result.sent!==0)throw Error('Preparação não confirmada. Consulte os relatórios.');if(active()&&current===generation){busy=false;notice='Relatórios preparados. Nenhum email foi enviado.';await load(true);}}
    catch(error){if(active()&&current===generation){busy=false;state('error','A preparação não foi confirmada. Consulte os relatórios antes de gerar novamente.');controls();}}
  }
  async function sendOne(row) {
    if(!active()||busy||!data||data.blocked||row.delivery||!navigator.onLine)return;
    const selected=data.monthRef,current=generation;
    if(selected!==month.value||observed!==selection())return changed();
    busy=true;controls();state('loading','A processar o envio confirmado…');
    try{
      const result=await request('send-now',{monthRef:selected,reportId:row.reportId,reviewToken:row.reviewToken,requestId:crypto.randomUUID(),confirmed:true},current);
      if(result.monthRef!==selected||result.delivery?.reportId!==row.reportId||result.delivery?.recipient!==row.to||!outcomes[result.delivery?.status]||result.deliveryConfirmed!==false)throw Error('Resultado não confirmado.');
      if(active()&&current===generation){busy=false;notice=outcomes[result.delivery.status];await load(true);}
    }catch(_){if(active()&&current===generation){busy=false;data=null;list.replaceChildren();el('mailPaging').hidden=true;state('uncertain','O resultado não foi confirmado. Consulte os relatórios e envios antes de qualquer nova tentativa.');controls();}}
  }
  el('mailLoad').addEventListener('click',()=>void load());el('mailPrepare').addEventListener('click',()=>void prepare());
  el('mailPrevious').addEventListener('click',()=>{if(active()&&!busy&&page>0){page--;render();}});el('mailNext').addEventListener('click',()=>{if(active()&&!busy&&data&&(page+1)*6<data.rows.length){page++;render();}});
  month.addEventListener('input',changed);month.addEventListener('change',changed);mode.addEventListener('change',changed);
  window.addEventListener('storage',active);window.addEventListener('focus',active);document.addEventListener('visibilitychange',active);
  // Observe same-tab A–B–A changes immediately, without clearing unrelated drafts.
  for(const method of ['setItem','removeItem','clear']){
    const original=Storage.prototype[method];
    Storage.prototype[method]=function(...args){const result=Reflect.apply(original,this,args);if(this===localStorage&&(method==='clear'||keys.includes(String(args[0]))))active();return result;};
  }
  window.addEventListener('pagehide',changed);window.addEventListener('pageshow',changed);window.addEventListener('online',controls);window.addEventListener('offline',controls);
  setInterval(()=>{if(active()){if(observed!==selection())changed();else controls();}},500);
  changed();
})();

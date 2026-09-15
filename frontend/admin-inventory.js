function el(id) { return document.getElementById(id); }
function money(v) { return Number(v || 0).toFixed(2); }
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  prompt: async () => null,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

const inventoryToken = () => window.CristalAuth?.getToken?.() || localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
function inventoryOwner() {
  const user = JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || 'null');
  if (user?.role !== 'ADMIN' || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) throw Error('Sessão de administrador necessária.');
  return `ADMIN:${Number(user.id)}`;
}
let inventoryPrincipal, inventoryCredential, inventoryClosed = false, inventoryReady = false, refreshVersion = 0;
try { inventoryPrincipal = inventoryOwner(); inventoryCredential = inventoryToken(); } catch { inventoryClosed = true; }
function inventorySession() {
  let current; try { current = inventoryOwner(); } catch {}
  if (inventoryClosed || !inventoryCredential || inventoryCredential !== inventoryToken() || inventoryPrincipal !== current) {
    inventoryClosed = true; inventoryReady = false; PRODUCTS = [];
    const main = document.querySelector('main.page'); if (main) main.style.display = 'none';
    document.querySelectorAll('.cw-ui-modal .cw-ui-btn-muted').forEach(button => button.click());
    if (!el('inventorySessionChanged')) { const node = document.createElement('p'); node.id = 'inventorySessionChanged'; node.setAttribute('role', 'alert'); node.textContent = 'A sessão mudou. Reabra o inventário com a conta correta. Os pedidos guardados foram mantidos.'; document.body.prepend(node); }
    throw Error('A sessão mudou. Reabra o inventário.');
  }
}
function authHeaders(extra = {}) { inventorySession(); return { ...extra, Authorization: `Bearer ${inventoryCredential}` }; }
for (const event of ['storage', 'focus']) window.addEventListener(event, () => { try { inventorySession(); } catch {} });

function setStatus(message, tone = "info") {
  const node = el("inventoryStatus");
  if (!node) return;
  node.textContent = message;
  node.className = `status ${tone === "info" ? "" : tone}`.trim();
}

function showFormError(form,message){
  let node=form.querySelector('[data-inventory-feedback]');if(!node){node=document.createElement('div');node.dataset.inventoryFeedback='true';node.className='status error';node.setAttribute('role','alert');form.appendChild(node);}node.textContent=message;
}
function clearFormError(form){form.querySelector('[data-inventory-feedback]')?.remove();}
function userError(error, fallback) {
  if(/failed to fetch|networkerror|load failed/i.test(error?.message||''))return 'Ligação interrompida. Repita o pedido com os mesmos dados; o sistema evita duplicações.';
  return ui.safeError(error, fallback || "Nao foi possivel concluir a operacao.");
}

function itemHtml(balance) {
  return `<div class="item"><b>${esc(balance.productName)}</b> · ${esc(balance.quantity)} ${esc(balance.unit)} <span class="muted">${esc(balance.scope)}${balance.vehicleId ? ` · viatura ${esc(balance.vehicleId)}` : ""}</span></div>`;
}

let PRODUCTS = [];

function addRow() {
  const d = document.createElement("div");
  d.className = "row";
  d.innerHTML = `
    <input placeholder="Produto" aria-label="Produto" data-k="productName">
    <input placeholder="Qtd" aria-label="Quantidade" type="number" step="0.01" data-k="quantity">
    <input placeholder="Un" aria-label="Unidade" value="KG" data-k="unit">
    <input placeholder="Custo/un" aria-label="Custo por unidade" type="number" step="0.01" data-k="unitCost">
  `;
  el("items")?.appendChild(d);
}

function collectRows() {
  return [...document.querySelectorAll("#items .row")]
    .map((r) => {
      const o = {};
      r.querySelectorAll("input").forEach((i) => { o[i.dataset.k] = i.value; });
      return o;
    })
    .filter((x) => x.productName || x.quantity || x.unitCost);
}

async function api(url, opt) {
  inventorySession();
  const res = await fetch(url, {
    ...opt,
    headers: authHeaders({ ...(opt?.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...opt?.headers }),
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  inventorySession();
  let data;
  try { data = await res.json(); } catch { inventorySession(); throw Error('Não foi possível validar a resposta do servidor. Atualize ou repita a confirmação.'); }
  inventorySession();
  if (!res.ok || !data || (!Array.isArray(data) && data.ok !== true)) {
    throw Object.assign(Error(data?.error || data?.message || `Resposta não confirmada (HTTP ${res.status}).`), { status: res.status });
  }
  return data;
}

function renderProducts(data) {
  PRODUCTS = data.products || [];

  let target = el("products");
  if (!target) {
    const s = document.createElement("section");
    s.className = "card section-gap";
    s.innerHTML = '<h2>Produtos</h2><div id="products" class="list"></div>';
    document.querySelector("main.page")?.appendChild(s);
    target = el("products");
  }

  target.innerHTML = PRODUCTS.length
    ? PRODUCTS.map((p) => `
      <div class="item">
        <b>${esc(p.name)}</b>
        ${p.active === false ? '<span class="ds-badge is-muted">Arquivado</span>' : '<span class="ds-badge">Ativo</span>'}
        <div class="muted">SKU: ${esc(p.sku || "-")} · Categoria: ${esc(p.category || "-")} · Unidade: ${esc(p.unit || "-")} · Custo: EUR ${money(p.defaultCost)}</div>
        <div class="actions">
          <button class="cw-v2-btn" onclick="editProduct(${p.id})">Editar</button>
          ${p.active === false ? `<button class="cw-v2-btn" onclick="restoreProduct(${p.id})">Restaurar</button>` : `<button class="cw-v2-btn" onclick="archiveProduct(${p.id})">Arquivar</button>`}
          <button class="cw-v2-btn danger" onclick="deleteProduct(${p.id})">Eliminar</button>
        </div>
      </div>
    `).join("")
    : '<p class="muted">Sem produtos registados. Proxima acao: criar um produto para começar o stock.</p>';
}

async function refresh() {
  inventorySession(); const version=++refreshVersion; inventoryReady=false; renderWrites();
  setStatus("A atualizar stock e movimentos...");
  const [report,productData,vehiclesData] = await Promise.all([api('/api/inventory/report'),api('/api/inventory/products?includeInactive=true'),api('/api/guides/vehicles')]);
  inventorySession(); if(version!==refreshVersion)return;
  if(!Array.isArray(report.balances)||!Array.isArray(report.lastMovements)||!Array.isArray(productData.products))throw Error('O inventário recebido está incompleto. Atualize antes de guardar.');
  el("stock").innerHTML = (report.balances || []).map(itemHtml).join("") || '<p class="muted">Sem stock. Proxima acao: registar uma entrada de stock por fatura.</p>';
  el("movements").innerHTML = (report.lastMovements || []).map((m) => `
    <div class="item">
      <b>${esc(m.movementType)}</b> · ${esc(m.productName)} · ${esc(m.quantity)} ${esc(m.unit)}
      <br><span class="muted">${new Date(m.createdAt).toLocaleString("pt-PT")}</span>
    </div>
  `).join("") || '<p class="muted">Sem movimentos. Proxima acao: efetuar uma entrada, transferencia ou consumo.</p>';
  renderProducts(productData);
  const vehicles=Array.isArray(vehiclesData)?vehiclesData:vehiclesData.vehicles||vehiclesData.data||[];
  const vehicleSelection=el('transferVehicleId').value;el('transferVehicleId').innerHTML='<option value="">Selecionar viatura</option>'+vehicles.filter(v=>v.active!==false&&!v.deletedAt&&(!v.archiveStatus||v.archiveStatus==='ATIVO')).map(v=>`<option value="${v.id}">${esc(v.plate||v.name||'Viatura '+v.id)}</option>`).join('');el('transferVehicleId').value=vehicleSelection;
  const productSelection=el('transferProductName').value;el('transferProductName').innerHTML='<option value="">Selecionar produto do armazém</option>'+(report.balances||[]).filter(b=>b.scope==='CENTRAL'&&Number(b.quantity)>0).map(b=>`<option value="${esc(JSON.stringify([b.productName,b.unit]))}" data-product-name="${esc(b.productName)}" data-unit="${esc(b.unit)}" data-quantity="${Number(b.quantity)}">${esc(b.productName)} · ${esc(b.quantity+' '+b.unit)}</option>`).join('');el('transferProductName').value=productSelection;
  const updateTransferProduct=()=>{const option=el('transferProductName').selectedOptions[0];el('transferUnit').value=option?.dataset.unit||'';el('transferQuantity').max=option?.dataset.quantity||'';el('transferAvailability').textContent=option?.dataset.quantity?'Saldo consultado: '+option.dataset.quantity+' '+option.dataset.unit+'. A disponibilidade volta a ser verificada ao guardar.':'';};el('transferProductName').onchange=updateTransferProduct;updateTransferProduct();
  const consumeVehicle=el('consumeVehicleId'),oldVehicle=consumeVehicle.value;
  consumeVehicle.innerHTML=el('transferVehicleId').innerHTML;consumeVehicle.value=oldVehicle;
  const updateConsumptionUnit=()=>{const option=el('consumeProductName').selectedOptions[0];el('consumeUnit').value=option?.dataset.unit||'';el('consumeQuantity').max=option?.dataset.quantity||'';};
  const updateConsumptionProducts=()=>{const select=el('consumeProductName'),oldProduct=select.value;select.innerHTML='<option value="">Selecionar produto da viatura</option>'+(report.balances||[]).filter(b=>b.scope==='VEHICLE'&&String(b.vehicleId)===consumeVehicle.value&&Number(b.quantity)>0).map(b=>`<option value="${esc(JSON.stringify([b.productName,b.unit]))}" data-product-name="${esc(b.productName)}" data-unit="${esc(b.unit)}" data-quantity="${Number(b.quantity)}">${esc(b.productName+' · '+b.quantity+' '+b.unit)}</option>`).join('');select.value=oldProduct;updateConsumptionUnit();};
  consumeVehicle.onchange=updateConsumptionProducts;el('consumeProductName').onchange=updateConsumptionUnit;updateConsumptionProducts();
  inventoryReady=true; renderWrites(); setStatus("Inventario atualizado.", "ok");
}

async function editProduct(id) {
  const p = PRODUCTS.find((x) => Number(x.id) === Number(id));
  if (!p) return;
  const name = await ui.prompt("Indica o nome do produto.", { title: "Editar produto", defaultValue: p.name || "", confirmText: "Seguinte" });
  if (name === null) return;
  const sku = await ui.prompt("Indica o SKU (opcional).", { title: "Editar produto", defaultValue: p.sku || "", confirmText: "Seguinte" });
  if (sku === null) return;
  const category = await ui.prompt("Indica a categoria.", { title: "Editar produto", defaultValue: p.category || "CHEMICAL", confirmText: "Seguinte" });
  if (category === null) return;
  const unit = await ui.prompt("Indica a unidade.", { title: "Editar produto", defaultValue: p.unit || "KG", confirmText: "Seguinte" });
  if (unit === null) return;
  const defaultCost = await ui.prompt("Indica o custo padrao em EUR.", { title: "Editar produto", defaultValue: String(p.defaultCost || 0), confirmText: "Seguinte" });
  if (defaultCost === null) return;
  const notes = await ui.prompt("Notas internas (opcional).", { title: "Editar produto", defaultValue: p.notes || "", confirmText: "Guardar" });
  if (notes === null) return;
  await api(`/api/inventory/products/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, sku: sku || null, category, unit, defaultCost, notes }),
  });
  ui.success("Produto atualizado com sucesso.");
  await refresh();
}

async function archiveProduct(id) {
  await api(`/api/inventory/products/${id}`, { method: "PUT", body: JSON.stringify({ active: false }) });
  await refresh();
}

async function restoreProduct(id) {
  await api(`/api/inventory/products/${id}/restore`, { method: "POST" });
  await refresh();
}

async function deleteProduct(id) {
  const approved = await ui.confirm("O produto sera eliminado apenas se nao existir historico. Caso contrario, sera arquivado. Queres continuar?", {
    title: "Confirmar eliminacao",
    confirmText: "Continuar",
    danger: true,
  });
  if (!approved) return;
  await api(`/api/inventory/products/${id}`, { method: "DELETE" });
  ui.success("Operacao concluida no produto.");
  await refresh();
}

const writeStates = new Map();
const pendingKey = kind => `cwInventoryPending:${inventoryPrincipal}:${kind}`;
const validUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function validatePending(record, kind) {
  if (!record) return null;
  try {
    if (record.version !== 1 || record.owner !== inventoryPrincipal || record.kind !== kind || record.key !== pendingKey(kind) || !validUuid(record.requestId) || !record.body || typeof record.body !== 'object' || Array.isArray(record.body) || typeof record.legacyKey !== 'string' || record.rejection && typeof record.rejection !== 'string' || record.fileBlob && (!(record.fileBlob instanceof Blob) || typeof record.fileName !== 'string')) throw Error();
    const b=record.body, rows=kind==='purchase'?JSON.parse(b.items):kind==='transfer'?b.items:[b];
    if(!Array.isArray(rows)||!rows.length||rows.some(row=>!row||typeof row.productName!=='string'||typeof row.unit!=='string'||!['string','number'].includes(typeof row.quantity)))throw Error();
    if(kind==='purchase'&&Object.values(b).some(value=>typeof value!=='string'))throw Error();
    if(kind!=='purchase'&&!['string','number'].includes(typeof b.vehicleId))throw Error();
  } catch { throw Error('O pedido guardado não pôde ser lido. Foi mantido para revisão; não envie outro pedido igual.'); }
  return record;
}
async function inventoryRequest(kind, payload) {
  inventorySession();
  const user=JSON.parse(localStorage.getItem('user')||localStorage.getItem('cristalwater_user')||'null');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([user.role,user.id,payload])));
  inventorySession();
  const key='cwInventoryWrite:'+kind+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  return {legacyKey:key,requestId:localStorage.getItem(key)||crypto.randomUUID()};
}
function pendingSummary(record) {
  const b=record.body;
  if(record.kind==='purchase') {
    const rows=JSON.parse(b.items);
    return `${b.supplierName} · Documento: ${b.invoiceNumber||'sem referência'} · ${rows.map(row=>`${row.productName}: ${row.quantity} ${row.unit||'KG'}, custo/un. ${row.unitCost||'0'} €`).join('; ')} · Total indicado: ${b.totalAmount||'0'} €${record.fileName?' · Anexo: '+record.fileName:''}`;
  }
  const row=record.kind==='transfer'?b.items[0]:b;
  return `${record.vehicleLabel||'Viatura '+b.vehicleId} · ${row.productName}: ${row.quantity} ${row.unit}${b.workGuideId?' · Guia: '+b.workGuideId:''}`;
}
function renderWrites() {
  for(const state of writeStates.values()) {
    const {form,record}=state,button=form.querySelector('button[type=submit]');
    const disabled=state.busy||state.blocked||!inventoryReady||Boolean(record)||inventoryClosed;
    form.querySelectorAll('input,select,textarea,button').forEach(node=>{node.disabled=disabled;});
    button.disabled=state.busy||state.blocked||inventoryClosed||(!record&&!inventoryReady)||Boolean(record?.rejection);
    button.textContent=record?'Repetir confirmação':state.label;
    let box=form.querySelector('[data-inventory-pending]');
    if(!record){box?.remove();continue;}
    if(!box){box=document.createElement('div');box.dataset.inventoryPending='true';box.className='item';form.prepend(box);}
    box.replaceChildren();
    const title=document.createElement('strong');title.textContent=record.rejection?'Pedido recusado pelo servidor':'Pedido por confirmar';
    const summary=document.createElement('p');summary.textContent=pendingSummary(record);
    const message=document.createElement('p');message.textContent=record.rejection||'O pedido e o anexo estão guardados neste navegador. Repita a confirmação antes de iniciar outro movimento deste tipo.';
    box.append(title,summary,message);
    if(record.rejection){const correct=document.createElement('button');correct.type='button';correct.textContent='Corrigir pedido recusado';correct.disabled=state.busy||state.blocked||inventoryClosed;correct.onclick=()=>correctWrite(state);box.append(correct);}
  }
}
async function correctWrite(state) {
  if(state.busy||!state.record?.rejection||inventoryClosed)return;
  state.busy=true;renderWrites();
  try{
    await navigator.locks.request(pendingKey(state.kind),{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Existe uma operação em curso noutra janela. Volte a tentar.');
      inventorySession();
      const record=validatePending(await CWInventoryPending.read(pendingKey(state.kind)),state.kind);
      inventorySession();if(!record?.rejection||record.requestId!==state.record.requestId)throw Error('O pedido mudou noutra janela. Atualize o inventário.');
      await refresh();state.restore(record);inventorySession();
      localStorage.removeItem(record.legacyKey);await CWInventoryPending.remove(record.key,record.requestId);inventorySession();
      state.record=null;clearFormError(state.form);setStatus('Reveja os dados recuperados e confirme a correção antes de voltar a guardar.');
    });
  }catch(error){if(!inventoryClosed)showFormError(state.form,userError(error));}
  finally{state.busy=false;renderWrites();}
}
async function executeWrite(state) {
  if(state.busy||state.blocked||inventoryClosed||!state.record&&!inventoryReady)return;
  if(!navigator.locks?.request){showFormError(state.form,'Abra o inventário num navegador atualizado para proteger os pedidos entre janelas.');return;}
  state.busy=true;state.form.querySelector('button[type=submit]').disabled=true;clearFormError(state.form);
  try{
    await navigator.locks.request(pendingKey(state.kind),{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Existe uma operação em curso noutra janela. Volte a tentar.');
      inventorySession();
      const stored=validatePending(await CWInventoryPending.read(pendingKey(state.kind)),state.kind);inventorySession();
      if(stored&&(!state.record||stored.requestId!==state.record.requestId)){state.record=stored;setStatus('Pedido pendente recuperado. Reveja os dados e use Repetir confirmação.');renderWrites();return;}
      if(!stored&&state.record){state.record=null;setStatus('O pedido foi resolvido noutra janela. Atualize o inventário antes de iniciar outro.');inventoryReady=false;return;}
      if(stored?.rejection){state.record=stored;renderWrites();return;}
      if(!stored){
        if(!state.form.reportValidity())return;
        const building=state.build(state.form);renderWrites();
        const data=await building;inventorySession();
        const record={...data,version:1,owner:inventoryPrincipal,kind:state.kind,key:pendingKey(state.kind)};
        validatePending(record,state.kind);
        await CWInventoryPending.create(record);state.record=record;inventorySession();
      }
      const record=state.record;renderWrites();setStatus('A confirmar o movimento de stock...');
      try{
        let body;
        if(state.kind==='purchase'){
          body=new FormData();for(const [key,value] of Object.entries(record.body))body.append(key,value);
          if(record.fileBlob)body.append('document',record.fileBlob,record.fileName);
          body.append('requestId',record.requestId);
        }else body=JSON.stringify({...record.body,requestId:record.requestId});
        const result=await api(state.path,{method:'POST',body});
        if(!state.valid(result,record))throw Error('O servidor devolveu uma confirmação incompleta. Repita o pedido guardado.');
        inventorySession();localStorage.removeItem(record.legacyKey);await CWInventoryPending.remove(record.key,record.requestId);inventorySession();
        state.record=null;state.form.reset();if(state.kind==='purchase'){el('items').replaceChildren();addRow();}clearFormError(state.form);
        try{await refresh();setStatus(state.success,'ok');}catch(error){if(!inventoryClosed)setStatus('Movimento confirmado. Não foi possível atualizar os saldos; use Atualizar inventário.');}
      }catch(error){
        if(inventoryClosed)return;
        if([400,403,404,409,422].includes(error.status))state.record=await CWInventoryPending.reject(record.key,record.requestId,userError(error));
        inventorySession();setStatus(userError(error,'Não foi possível confirmar o movimento. Repita o pedido guardado.'),'error');showFormError(state.form,userError(error,'Repita a confirmação do pedido guardado.'));
      }
    });
  }catch(error){if(!inventoryClosed){setStatus(userError(error),'error');showFormError(state.form,userError(error));}}
  finally{state.busy=false;if(!inventoryClosed)renderWrites();}
}
function setFields(form,body){for(const [name,value] of Object.entries(body)){const node=form.elements.namedItem(name);if(node&&node.type!=='file')node.value=value??'';}}
function registerWrite(kind, formId, options) {
  const form=el(formId),state={kind,form,label:form.querySelector('button[type=submit]').textContent,busy:false,blocked:true,record:null,...options};
  writeStates.set(kind,state);form.addEventListener('submit',event=>{event.preventDefault();void executeWrite(state);});
}
registerWrite('purchase','purchaseForm',{
  path:'/api/inventory/purchases',success:'Entrada de stock confirmada.',
  async build(form){
    const fd=new FormData(form);fd.append('items',JSON.stringify(collectRows()));const file=fd.get('document');
    if(file?.size>20*1024*1024)throw Error('O anexo excede o limite de 20 MB.');
    let documentHash=null;
    if(file?.size){const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());documentHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
    const legacyPayload={...Object.fromEntries(fd),document:file?.size?{name:file.name,documentHash}:null};
    const identity=await inventoryRequest('purchase',legacyPayload);fd.delete('document');
    return {...identity,body:Object.fromEntries(fd),...(file?.size?{fileBlob:file,fileName:file.name}: {})};
  },
  valid:(data,record)=>data.ok===true&&Number.isSafeInteger(data.purchase?.id)&&data.purchase.id>0&&Array.isArray(data.items)&&data.items.length===JSON.parse(record.body.items).length&&data.items.every(row=>Number.isSafeInteger(row.id)&&row.purchaseId===data.purchase.id),
  restore(record){setFields(el('purchaseForm'),record.body);el('items').replaceChildren();for(const row of JSON.parse(record.body.items)){addRow();el('items').lastElementChild.querySelectorAll('input').forEach(input=>{input.value=row[input.dataset.k]??'';});}if(record.fileBlob){const files=new DataTransfer();files.items.add(new File([record.fileBlob],record.fileName,{type:record.fileBlob.type}));el('document').files=files.files;}}
});
registerWrite('transfer','transferForm',{
  path:'/api/inventory/transfer-to-vehicle',success:'Transferência de stock confirmada.',
  async build(form){
    const f=Object.fromEntries(new FormData(form)),option=el('transferProductName').selectedOptions[0];
    const body={vehicleId:f.vehicleId,items:[{productName:option?.dataset.productName||'',quantity:f.quantity,unit:f.unit||'KG'}]};
    const user=JSON.parse(localStorage.getItem('user')||localStorage.getItem('cristalwater_user')||'null'),legacyKey='cwInventoryTransfer:'+JSON.stringify([user.id,body]);
    return {body,legacyKey,requestId:localStorage.getItem(legacyKey)||crypto.randomUUID(),vehicleLabel:el('transferVehicleId').selectedOptions[0]?.textContent};
  },
  valid:(data,record)=>data.ok===true&&Array.isArray(data.movements)&&data.movements.length===1&&data.movements.every(row=>Number.isSafeInteger(row.id)&&row.id>0&&row.vehicleId===Number(record.body.vehicleId)&&row.unit===record.body.items[0].unit&&row.quantity===Number(record.body.items[0].quantity)),
  restore(record){el('transferVehicleId').value=record.body.vehicleId;el('transferProductName').value=JSON.stringify([record.body.items[0].productName,record.body.items[0].unit]);el('transferProductName').dispatchEvent(new Event('change'));el('transferQuantity').value=record.body.items[0].quantity;}
});
registerWrite('consume','consumeForm',{
  path:'/api/inventory/consume',success:'Consumo de stock confirmado.',
  async build(form){const body=Object.fromEntries(new FormData(form));body.productName=el('consumeProductName').selectedOptions[0]?.dataset.productName||'';return {...await inventoryRequest('consume',body),body,vehicleLabel:el('consumeVehicleId').selectedOptions[0]?.textContent};},
  valid:(data,record)=>data.ok===true&&Number.isSafeInteger(data.movement?.id)&&data.movement.id>0&&data.movement.vehicleId===Number(record.body.vehicleId)&&data.movement.unit===record.body.unit&&data.movement.quantity===Number(record.body.quantity),
  restore(record){el('consumeVehicleId').value=record.body.vehicleId;el('consumeVehicleId').dispatchEvent(new Event('change'));el('consumeProductName').value=JSON.stringify([record.body.productName,record.body.unit]);el('consumeProductName').dispatchEvent(new Event('change'));el('consumeQuantity').value=record.body.quantity;el('workGuideId').value=record.body.workGuideId||'';}
});
async function reloadInventory(){
  try{
    inventorySession();inventoryReady=false;renderWrites();
    for(const state of writeStates.values()){
      if(state.busy)continue;
      state.blocked=true;state.record=validatePending(await CWInventoryPending.read(pendingKey(state.kind)),state.kind);inventorySession();state.blocked=false;
    }
    await refresh();
  }catch(error){if(!inventoryClosed){setStatus(userError(error),'error');renderWrites();}}
}
window.reloadInventory=reloadInventory;

window.addRow = addRow;
window.editProduct = editProduct;
window.archiveProduct = archiveProduct;
window.restoreProduct = restoreProduct;
window.deleteProduct = deleteProduct;

addRow();
renderWrites();
void reloadInventory();

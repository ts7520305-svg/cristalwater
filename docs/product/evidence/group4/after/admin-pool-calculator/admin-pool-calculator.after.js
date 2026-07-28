const API = `${location.origin}/api`;
const fields = ['shape','shapeFactor','lengthM','widthM','diameterM','depthMinM','depthMaxM','averageDepthM','surfaceM2','volumeM3','pumpFlowM3h','pumpPowerHp','bathersAverage','poolLoad','saltCurrentPpm','targetSalinityPpm','chlorinatorGph','chlorineCurrentPpm','targetChlorinePpm','alkalinityCurrentPpm','targetAlkalinityPpm','phCurrent','targetPh','orpCurrentMv','targetOrpMv','heatPumpPhase','heatPumpThermalKw','heatPumpElectricalKw','cop','currentWaterTempC','targetWaterTempC','covered','ambientLossFactor','notes'];

function qs(name){ return new URLSearchParams(location.search).get(name); }
function el(id){ return document.getElementById(id); }
function val(id){ const e=el(id); return e ? e.value : ''; }
function setVal(id,v){ const e=el(id); if(e && v !== undefined && v !== null) e.value = v; }
function status(msg){ el('status').textContent = msg || ''; }
function payload(){ const out={}; fields.forEach(f=>out[f]=val(f)); return out; }
function fmt(v,s=''){ if(v===null||v===undefined||Number.isNaN(v)) return '-'; return `${v}${s}`; }
function row(label,value){ return `<div class="resultRow"><span>${label}</span><span class="value">${value ?? '-'}</span></div>`; }

async function loadPools(){
  const res = await fetch(`${API}/pools`);
  const data = await res.json();
  const pools = Array.isArray(data) ? data : (data.pools || data.data || []);
  el('poolId').innerHTML = pools.map(p=>`<option value="${p.id}">${p.client?.name ? p.client.name + ' · ' : ''}${p.name || 'Piscina #' + p.id}</option>`).join('');
  const selected = qs('poolId') || qs('id');
  if(selected) el('poolId').value = selected;
  await loadPool();
}

async function onPoolChange(){ await loadPool(); history.replaceState(null,'',`/admin-pool-calculator?poolId=${val('poolId')}`); }

async function loadPool(){
  const id = val('poolId'); if(!id) return;
  status('A carregar ficha técnica e cálculos...');
  const res = await fetch(`${API}/pool-calculations/${id}`);
  const data = await res.json();
  if(!data.ok){ status(data.error || 'Erro ao carregar piscina'); return; }
  const pool = data.pool || {};
  const p = data.profile || {};
  el('poolBadge').textContent = `${pool.client?.name || 'Cliente'} · ${pool.name || 'Piscina #' + id}`;
  fields.forEach(f => { if(p[f] !== undefined && p[f] !== null) setVal(f, p[f]); });
  if(!p.volumeM3 && pool.volumeM3) setVal('volumeM3', pool.volumeM3);
  if(!p.shape && pool.type) setVal('shape', pool.type);
  renderCalculation(data.calculation);
  status('Cálculo carregado. Ajusta os campos e guarda na ficha da piscina.');
}

async function previewCalculation(){
  status('A calcular...');
  const res = await fetch(`${API}/pool-calculations/preview`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});
  const data = await res.json();
  renderCalculation(data.calculation);
  status('Pré-visualização calculada. Ainda não foi guardada na ficha.');
}

async function saveAndCalculate(){
  const id = val('poolId'); if(!id) return alert('Escolhe uma piscina.');
  status('A guardar cálculo na ficha da piscina...');
  const res = await fetch(`${API}/pool-calculations/${id}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});
  const data = await res.json();
  if(!data.ok){ status(data.error || 'Erro ao guardar'); return; }
  renderCalculation(data.calculation);
  status('Guardado na ficha da piscina. Estes valores podem ser usados para otimização, IA e recomendações futuras.');
}

function renderBlock(id, rows){ el(id).innerHTML = rows.join(''); }

function calculateChemistryLocal(){
  const volume=Number(val('volumeM3'))||0;
  const alk=Number(val('alkalinityCurrentPpm')); const targetAlk=Number(val('targetAlkalinityPpm'))||100;
  const ph=Number(val('phCurrent')); const targetPh=Number(val('targetPh'))||7.4;
  const orp=Number(val('orpCurrentMv')); const targetOrp=Number(val('targetOrpMv'))||720;
  const rows=[]; const rec=[];
  if(Number.isFinite(alk)){ const diff=targetAlk-alk; rows.push(row('Alcalinidade atual',fmt(alk,' ppm'))); rows.push(row('Alcalinidade alvo',fmt(targetAlk,' ppm'))); if(diff>0&&volume>0){const kg=Math.round(diff*volume*0.0015*100)/100; rows.push(row('Bicarbonato estimado',fmt(kg,' kg'))); rec.push(`Alcalinidade baixa: adicionar cerca de ${kg} kg de bicarbonato, por fases.`);} else if(diff< -20){rec.push('Alcalinidade alta: corrigir gradualmente com controlo de pH e nova medição.');}}
  if(Number.isFinite(ph)){ rows.push(row('pH atual',ph)); rows.push(row('pH alvo',targetPh)); if(ph>7.6&&volume>0){const kg=Math.round((ph-targetPh)*volume*0.12*100)/100; rows.push(row('pH- estimado',fmt(Math.max(0,kg),' kg'))); rec.push(`pH alto: adicionar pH- aproximadamente ${Math.max(0,kg)} kg e voltar a medir.`);} else if(ph<7.2&&volume>0){const kg=Math.round((targetPh-ph)*volume*0.10*100)/100; rows.push(row('pH+ estimado',fmt(Math.max(0,kg),' kg'))); rec.push(`pH baixo: adicionar pH+ aproximadamente ${Math.max(0,kg)} kg e voltar a medir.`);}}
  if(Number.isFinite(orp)){ rows.push(row('ORP / Redox atual',fmt(orp,' mV'))); rows.push(row('ORP / Redox alvo',fmt(targetOrp,' mV'))); if(orp<650) rec.push('ORP baixo: verificar pH, cloro livre, estabilizador e estado da célula/bomba doseadora.');}
  if(!rows.length) rows.push('<p class="note">Preenche pH, alcalinidade ou ORP para obter recomendações químicas.</p>');
  return {rows, rec};
}

function renderCalculation(c){
  if(!c) return;
  el('kVolume').textContent = fmt(c.geometry?.volumeM3,' m³');
  el('kArea').textContent = fmt(c.geometry?.surfaceM2,' m²');
  el('kSalt').textContent = fmt(c.salt?.saltKgToAdd,' kg');
  el('kHeat').textContent = c.heatPump?.estimatedHoursToTarget ? `${c.heatPump.estimatedHoursToTarget} h` : '-';
  el('recommendations').innerHTML = (c.recommendations||[]).map(x=>`<div class="rec">${x}</div>`).join('');
  renderBlock('geometry', [row('Formato',c.geometry?.shape),row('Fórmula',c.geometry?.formula),row('Área',fmt(c.geometry?.surfaceM2,' m²')),row('Cubicagem',fmt(c.geometry?.volumeM3,' m³')),row('Litros',fmt(c.geometry?.volumeLitres,' L'))]);
  renderBlock('filtration', [row('Caudal bomba',fmt(c.filtration?.pumpFlowM3h,' m³/h')),row('1 recirculação',fmt(c.filtration?.oneTurnoverHours,' h')),row('Mínimo diário',fmt(c.filtration?.minimumFiltrationHoursDay,' h')),row('Ideal diário',fmt(c.filtration?.idealFiltrationHoursDay,' h')),row('Programa',c.filtration?.suggestedProgram)]);
  renderBlock('salt', [row('Sal atual',fmt(c.salt?.saltCurrentPpm,' ppm')),row('Sal alvo',fmt(c.salt?.targetSalinityPpm,' ppm')),row('Falta',fmt(c.salt?.saltMissingPpm,' ppm')),row('Adicionar',fmt(c.salt?.saltKgToAdd,' kg')),`<p class="note">${c.salt?.note||''}</p>`]);
  renderBlock('chlorination', [row('Máquina',fmt(c.chlorination?.chlorinatorGph,' g/h')),row('Cloro para alvo',fmt(c.chlorination?.chlorineGramsToReachTarget,' g')),row('Horas até alvo',fmt(c.chlorination?.chlorinatorHoursToReachTarget,' h')),row('Procura diária estimada',fmt(c.chlorination?.estimatedDailyChlorineGrams,' g/dia')),row('Horas produção/dia',fmt(c.chlorination?.estimatedDailyProductionHours,' h')),row('Máquina ideal',c.chlorination?.idealChlorinatorRangeGph)]);
  renderBlock('heatPump', [row('Temperatura atual',fmt(c.heatPump?.currentWaterTempC,' °C')),row('Temperatura alvo',fmt(c.heatPump?.targetWaterTempC,' °C')),row('Subida necessária',fmt(c.heatPump?.deltaT,' °C')),row('Cobertura',c.heatPump?.covered?'Sim':'Não'),row('Energia térmica ajustada',fmt(c.heatPump?.thermalEnergyKwhAdjusted,' kWh')),row('Consumo elétrico estimado',fmt(c.heatPump?.estimatedElectricKwh,' kWh')),row('Horas até alvo',fmt(c.heatPump?.estimatedHoursToTarget,' h')),`<p class="note">${c.heatPump?.note||''}</p>`]);
  const chem=calculateChemistryLocal(); renderBlock('chemistry', chem.rows); if(chem.rec.length){ el('recommendations').innerHTML += chem.rec.map(x=>`<div class="rec">${x}</div>`).join(''); }
}
function clearInputs(){ fields.forEach(f=>{ if(!['shape','poolLoad','targetSalinityPpm','targetChlorinePpm','cop','targetWaterTempC','covered'].includes(f)) setVal(f,''); }); status('Campos limpos.'); }

loadPools().catch(err=>status(err.message));

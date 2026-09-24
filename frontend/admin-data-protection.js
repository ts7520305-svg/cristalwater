(() => {
 'use strict';
 const el=id=>document.getElementById(id),panel=el('dataProtectionPanel');if(!panel)return;
 const token=()=>window.CristalAuth?.getToken?.()||localStorage.getItem('token')||'',owner=token();
 let review=null,busy=false;
 function clearReview(){review=null;el('applyGpsRetention').disabled=true;el('retentionConfirm').value='';}
 function session(){if(!owner||token()!==owner){clearReview();panel.hidden=true;throw Error('Sessão alterada. Reabra a página.');}}
 async function api(url,body){session();const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${owner}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();session();if(!r.ok)throw Error(d.error||'Não foi possível concluir.');return d;}
 async function run(fn){if(busy)return;busy=true;const buttons=[...panel.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){clearReview();el('retentionStatus').textContent=e.message;}finally{busy=false;buttons.forEach(b=>b.disabled=false);el('applyGpsRetention').disabled=!review;}}
 const labels={SCHEDULE_FAILED:'A última cópia agendada falhou. Consulte o serviço de backups no servidor.',SCHEDULE_INTERRUPTED:'A cópia agendada ficou interrompida ou excedeu o tempo previsto. Reveja o processo e o bloqueio antes de voltar a executar.',SCHEDULE_RUNNING:'Cópia agendada em curso; ainda sem confirmação.',SCHEDULE_UNREADABLE:'Não foi possível validar o resultado da cópia agendada.',MISSING:'Não existe cópia local identificada.',EMPTY:'A cópia mais recente está vazia.',STALE:'A cópia local está desatualizada.',JSON_FALLBACK:'Existe uma exportação JSON de recurso. Falta verificar um restauro compatível.',FUTURE_TIMESTAMP:'A data do ficheiro está no futuro. Verifique o relógio.',UNREADABLE:'Não foi possível ler a pasta de backups.',CONFIG_ERROR:'Configuração da verificação inválida.',RECENT_LOCAL_SQL:'Existe uma cópia SQL local recente. Restauro e cópia externa por verificar.'};
 el('checkBackupHealth').onclick=()=>run(async()=>{const d=await api('/api/system/release-safety'),h=d.backupHealth;if(!h)throw Error('Servidor sem verificação de backups.');el('backupHealthText').textContent=(labels[h.state]||'Estado por verificar.')+(h.latest?` Ficheiro: ${h.latest.name}. Idade: ${h.latest.ageHours} horas.`:'');});
 el('reviewGpsRetention').onclick=()=>run(async()=>{clearReview();const d=await api('/api/system/retention/preview');review=d;el('retentionPreview').textContent=`Antes de ${new Date(d.cutoff).toLocaleString('pt-PT')}: ${d.counts.total} registos.
Percursos: ${d.counts.technicianTracks}. Registos de localização: ${d.counts.locationLogs}.
Revisão válida durante cinco minutos.`;el('retentionStatus').textContent='Nenhum registo foi eliminado.';});
 el('applyGpsRetention').onclick=()=>{
  if(!review||busy)return;
  const confirmation=el('retentionConfirm').value,reason=el('retentionReason').value.trim();
  if(confirmation!=='ELIMINAR GPS ANTIGO'||reason.length<5)return el('retentionStatus').textContent='Confirme o texto e indique o motivo da limpeza.';
  if(!window.confirm(`Eliminar os ${review.counts.total} registos GPS revistos? Esta ação não pode ser desfeita pela aplicação.`))return;
  const body={previewToken:review.previewToken,confirmation,reason};
  run(async()=>{const d=await api('/api/system/retention/execute',body);clearReview();el('retentionPreview').textContent='';el('retentionStatus').textContent=`Limpeza concluída: ${d.deleted.total} registos GPS eliminados. Operação registada na auditoria.`;});
 };
 window.addEventListener('storage',()=>{try{session();}catch{}});
})();

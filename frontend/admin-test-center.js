const tests=['/api/system/health','/api/users','/api/crm/leads','/api/crm/reminders','/api/suppliers/suppliers','/api/security/status','/api/ai-admin/status'];
async function runTests(){const box=document.getElementById('results');box.innerHTML='';for(const url of tests){let ok=false, detail='';try{const r=await fetch(url); detail=`HTTP ${r.status}`; ok=r.ok;}catch(e){detail=e.message}box.innerHTML+=`<div class="card"><span class="badge">${ok?'OK':'ERRO'}</span><h3>${url}</h3><p class="${ok?'ok':'danger'}">${detail}</p></div>`;}}
runTests();

(function(){
  const status = document.getElementById('saveStatus');
  const pendingList = document.getElementById('pendingList');
  const releaseStatus = document.getElementById('releaseStatus');
  const releaseVersion = document.getElementById('releaseVersion');
  const releaseBackupDir = document.getElementById('releaseBackupDir');
  const backupList = document.getElementById('backupList');
  const backupNow = document.getElementById('backupNow');
  const copyRollbackPath = document.getElementById('copyRollbackPath');
  const upgradeZip = document.getElementById('upgradeZip');
  const uploadUpgradeZip = document.getElementById('uploadUpgradeZip');
  const upgradePackageList = document.getElementById('upgradePackageList');
  const rollbackUpgrade = document.getElementById('rollbackUpgrade');
  const accessControlStatus = document.getElementById('accessControlStatus');
  const permissionRole = document.getElementById('permissionRole');
  const modulePermissionList = document.getElementById('modulePermissionList');
  const infoPermissionList = document.getElementById('infoPermissionList');
  const savePermissionPolicyButton = document.getElementById('savePermissionPolicy');
  const teamLeaderSelect = document.getElementById('teamLeaderSelect');
  const teamLeaderZone = document.getElementById('teamLeaderZone');
  const teamLeaderTechnicians = document.getElementById('teamLeaderTechnicians');
  const teamLeaderPools = document.getElementById('teamLeaderPools');
  const teamLeaderNotes = document.getElementById('teamLeaderNotes');
  const saveTeamLeaderButton = document.getElementById('saveTeamLeader');
  const teamHierarchyList = document.getElementById('teamHierarchyList');
  let accessControlState = null;
  const actionLock = new Set();
  function toBool(v){ return String(v).toLowerCase()==='true'; }
  function authHeaders(extra = {}){
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('cristalwater_jwt');
    return Object.assign({}, token ? { Authorization: `Bearer ${token}` } : {}, extra);
  }
  async function parseJson(res, fallback){
    const data = await res.json().catch(() => ({}));
    if(!res.ok || data.ok === false) throw new Error(data.error || fallback);
    return data;
  }
  async function withActionLock(key, callback){
    if(actionLock.has(key)) return;
    actionLock.add(key);
    try {
      return await callback();
    } finally {
      actionLock.delete(key);
    }
  }
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, (ch)=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }
  function formatBytes(value){
    const n = Number(value || 0);
    if(n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    if(n > 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }
  function formatDate(value){
    if(!value) return '-';
    try { return new Date(value).toLocaleString('pt-PT'); } catch (_) { return String(value); }
  }
  async function load(){
    const res = await fetch('/api/settings/global', { headers: authHeaders() });
    const data = await parseJson(res, 'Erro ao carregar settings');
    document.querySelectorAll('[data-setting]').forEach((el)=>{ el.checked = toBool(data.settings[el.dataset.setting]); });
    status.textContent='Configurações carregadas.';
  }
  async function save(key,value){
    status.textContent='A gravar '+key+'...';
    await withActionLock(`setting:${key}`, async ()=>{
      const res = await fetch('/api/settings/global/'+encodeURIComponent(key),{
        method:'PUT',
        headers:authHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({value,actor:'admin'})
      });
      await parseJson(res, 'Erro ao gravar');
      status.textContent='Configuração gravada.';
    });
  }
  async function loadPending(){
    const res = await fetch('/api/technician-intake/pending-review', { headers: authHeaders() });
    const data = await parseJson(res, 'Erro ao carregar pendentes');
    if(!data.clients.length){ pendingList.innerHTML='<div class="status">Sem fichas pendentes.</div>'; return; }
    pendingList.innerHTML=data.clients.map(c=>`<div class="item"><strong>${c.name}</strong><br><small>${c.zone||''} · ${c.phone||''} · Piscinas: ${(c.pools||[]).length}</small><div class="actions"><button data-approve="${c.id}">Aprovar</button><a class="btn" href="/client-detail?id=${c.id}">Abrir ficha</a></div></div>`).join('');
    pendingList.querySelectorAll('[data-approve]').forEach(btn=>btn.addEventListener('click',()=>approve(btn.dataset.approve)));
  }
  async function approve(id){
    if(!confirm('Aprovar este cliente e ativar piscinas pendentes?')) return;
    await withActionLock(`approve:${id}`, async ()=>{
      const res = await fetch('/api/technician-intake/clients/'+id+'/approve',{
        method:'POST',
        headers:authHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({actor:'admin'})
      });
      const data = await parseJson(res, 'Erro ao aprovar');
      if(data.ok) loadPending();
    }).catch((err)=>alert(err.message));
  }
  function renderBackups(items){
    if(!backupList) return;
    if(!items || !items.length){
      backupList.innerHTML = '<div class="status">Ainda nao existem backups nesta pasta.</div>';
      return;
    }
    backupList.innerHTML = items.map((item)=>`
      <div class="backup-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong><br>
          <small>${escapeHtml(formatDate(item.updatedAt))} - ${escapeHtml(formatBytes(item.sizeBytes))}</small>
        </div>
        <small>${escapeHtml(item.type || 'backup')}</small>
      </div>
    `).join('');
  }
  function renderUpgradePackages(items, activation){
    if(!upgradePackageList) return;
    if(!items || !items.length){
      upgradePackageList.innerHTML = '<div class="status">Ainda nao existem pacotes ZIP carregados.</div>';
      return;
    }
    const canActivate = Boolean(activation && activation.enabled);
    upgradePackageList.innerHTML = items.map((item)=>`
      <div class="backup-row">
        <div>
          <strong>${escapeHtml(item.originalName || item.id)}</strong><br>
          <small>${escapeHtml(item.id)} - ${escapeHtml(item.status || 'STAGED')} - ${escapeHtml(formatBytes(item.sizeBytes))}</small><br>
          <small>Backup antes do upgrade: ${escapeHtml(item.backupBeforeUpgrade?.name || item.backupBeforeUpgrade?.file || 'registado')}</small>
        </div>
        <div class="actions">
          <button data-activate-upgrade="${escapeHtml(item.id)}" ${canActivate ? '' : 'disabled'}>Ativar</button>
        </div>
      </div>
    `).join('');
    upgradePackageList.querySelectorAll('[data-activate-upgrade]').forEach((btn)=>{
      btn.addEventListener('click', ()=>activateUpgrade(btn.dataset.activateUpgrade));
    });
  }
  async function loadUpgradeState(){
    if(!upgradePackageList) return;
    const res = await fetch('/api/system/upgrade', { headers: authHeaders() });
    const data = await parseJson(res, 'Erro ao carregar pacotes de upgrade');
    renderUpgradePackages(data.packages || [], data.activation || {});
    if(rollbackUpgrade) rollbackUpgrade.disabled = !(data.activation && data.activation.enabled && data.previousReleaseId);
  }
  async function loadReleaseSafety(){
    if(!releaseStatus) return;
    const res = await fetch('/api/system/release-safety', { headers: authHeaders() });
    const data = await parseJson(res, 'Erro ao carregar rollback/upgrade');
    releaseVersion.textContent = `Versao ${data.version || '-'} - ${data.mode || '-'}`;
    releaseBackupDir.textContent = data.backupDir || 'Pasta de backups nao definida';
    releaseStatus.textContent = data.rollbackPolicy || 'Rollback seguro ativo.';
    renderBackups(data.latestBackups || []);
    await loadUpgradeState();
  }
  async function createBackupNow(){
    if(!backupNow) return;
    if(!confirm('Criar backup da base de dados agora antes de atualizar?')) return;
    backupNow.disabled = true;
    releaseStatus.textContent = 'A criar backup. Aguarda um momento...';
    try{
      await withActionLock('backup-now', async ()=>{
        const res = await fetch('/api/system/backup', { method: 'POST', headers: authHeaders() });
        const data = await parseJson(res, 'Erro ao criar backup');
        releaseStatus.textContent = `Backup criado: ${data.backup?.name || data.backup?.file || 'ficheiro criado'}`;
        await loadReleaseSafety();
      });
    }catch(err){
      releaseStatus.textContent = err.message;
      alert(err.message);
    }finally{
      backupNow.disabled = false;
    }
  }
  async function copyGuidePath(){
    const text = 'docs/SAFE_RELEASE_AND_ROLLBACK.md';
    try{
      await navigator.clipboard.writeText(text);
      releaseStatus.textContent = 'Caminho do guia copiado.';
    }catch(_){
      releaseStatus.textContent = text;
    }
  }
  async function uploadZipPackage(){
    if(!upgradeZip || !uploadUpgradeZip) return;
    const file = upgradeZip.files && upgradeZip.files[0];
    if(!file) return alert('Escolhe primeiro o ficheiro ZIP da nova versao.');
    if(!String(file.name || '').toLowerCase().endsWith('.zip')) return alert('O ficheiro tem de ser .zip');
    if(!confirm('Enviar este ZIP e criar backup antes do upgrade?')) return;
    const body = new FormData();
    body.append('package', file);
    uploadUpgradeZip.disabled = true;
    releaseStatus.textContent = 'A enviar ZIP e a criar backup obrigatorio...';
    try{
      await withActionLock('upload-upgrade', async ()=>{
        const res = await fetch('/api/system/upgrade/upload', { method:'POST', headers: authHeaders(), body });
        const data = await parseJson(res, 'Erro ao preparar upgrade');
        releaseStatus.textContent = `Pacote preparado: ${data.package?.id || file.name}. Dados preservados.`;
        upgradeZip.value = '';
        await loadUpgradeState();
        await loadReleaseSafety();
      });
    }catch(err){
      releaseStatus.textContent = err.message;
      alert(err.message);
    }finally{
      uploadUpgradeZip.disabled = false;
    }
  }
  async function activateUpgrade(id){
    if(!id) return;
    if(!confirm('Ativar este pacote? No VPS isto deve trocar apenas a versao do codigo e preservar os dados.')) return;
    await withActionLock(`activate:${id}`, async ()=>{
      const res = await fetch('/api/system/upgrade/'+encodeURIComponent(id)+'/activate', { method:'POST', headers: authHeaders() });
      const data = await parseJson(res, 'Ativacao bloqueada.');
      releaseStatus.textContent = data.message || 'Upgrade ativado.';
      await loadUpgradeState();
    }).catch((err)=>{
      releaseStatus.textContent = err.message;
      alert(err.message);
    });
  }
  async function rollbackToPrevious(){
    if(!confirm('Voltar para a versao anterior sem mexer nos dados?')) return;
    await withActionLock('rollback-upgrade', async ()=>{
      const res = await fetch('/api/system/upgrade/rollback', { method:'POST', headers: authHeaders() });
      const data = await parseJson(res, 'Rollback bloqueado.');
      releaseStatus.textContent = data.message || 'Rollback registado.';
      await loadUpgradeState();
    }).catch((err)=>{
      releaseStatus.textContent = err.message;
      alert(err.message);
    });
  }
  function setAccessStatus(message){
    if(accessControlStatus) accessControlStatus.textContent = message;
  }
  function selectedValues(container){
    return Array.from(container?.querySelectorAll('input[type="checkbox"]:checked') || []).map((input)=>input.value);
  }
  function parseIds(value){
    return String(value || '')
      .split(',')
      .map((item)=>Number(String(item).trim()))
      .filter((item)=>Number.isInteger(item) && item > 0);
  }
  function renderPermissionOptions(container, items, selected){
    if(!container) return;
    const active = new Set(selected || []);
    container.innerHTML = (items || []).map((item)=>`
      <label class="permission-option">
        <input type="checkbox" value="${escapeHtml(item.key)}" ${active.has(item.key) ? 'checked' : ''}>
        <span>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.description || '')}</small>
        </span>
      </label>
    `).join('');
  }
  function renderPermissionMatrix(){
    if(!accessControlState || !permissionRole) return;
    const role = permissionRole.value || 'TEAM_LEADER';
    const data = accessControlState.policy?.roles?.[role] || {};
    renderPermissionOptions(modulePermissionList, accessControlState.modules || [], data.moduleAccess || []);
    renderPermissionOptions(infoPermissionList, accessControlState.informationTypes || [], data.informationAccess || []);
    setAccessStatus(`Perfil ${data.label || role} carregado. Ajusta os modulos e dados permitidos.`);
  }
  function renderTeamLeaderSelect(){
    if(!teamLeaderSelect || !accessControlState) return;
    const techs = accessControlState.technicians || [];
    if(!techs.length){
      teamLeaderSelect.innerHTML = '<option value="">Ainda nao existem tecnicos</option>';
      return;
    }
    teamLeaderSelect.innerHTML = '<option value="">Escolher tecnico chefe</option>' + techs.map((tech)=>`
      <option value="${tech.id}">${escapeHtml(tech.name || ('Tecnico ' + tech.id))} - ${escapeHtml(tech.zone || 'sem zona')}</option>
    `).join('');
  }
  function fillLeaderForm(leader){
    if(!leader) return;
    if(teamLeaderSelect) teamLeaderSelect.value = String(leader.technicianId || '');
    if(teamLeaderZone) teamLeaderZone.value = leader.zone || '';
    if(teamLeaderTechnicians) teamLeaderTechnicians.value = (leader.technicianIds || []).join(',');
    if(teamLeaderPools) teamLeaderPools.value = (leader.poolIds || []).join(',');
    if(teamLeaderNotes) teamLeaderNotes.value = leader.notes || '';
  }
  function renderTeamHierarchy(){
    if(!teamHierarchyList || !accessControlState) return;
    const leaders = accessControlState.hierarchy?.leaders || [];
    if(!leaders.length){
      teamHierarchyList.innerHTML = '<div class="status">Ainda nao ha chefes de equipa definidos.</div>';
      return;
    }
    teamHierarchyList.innerHTML = leaders.map((leader, index)=>`
      <div class="leader-row">
        <div>
          <strong>${escapeHtml(leader.name || ('Tecnico ' + leader.technicianId))}</strong><br>
          <small>Zona: ${escapeHtml(leader.zone || '-')} - Tecnicos: ${(leader.technicianIds || []).length} - Piscinas: ${(leader.poolIds || []).length}</small><br>
          <small>${escapeHtml(leader.notes || '')}</small>
        </div>
        <div class="actions">
          <button type="button" data-edit-leader="${index}">Editar</button>
          <button type="button" data-remove-leader="${index}">Remover</button>
        </div>
      </div>
    `).join('');
    teamHierarchyList.querySelectorAll('[data-edit-leader]').forEach((btn)=>{
      btn.addEventListener('click', ()=>fillLeaderForm(leaders[Number(btn.dataset.editLeader)]));
    });
    teamHierarchyList.querySelectorAll('[data-remove-leader]').forEach((btn)=>{
      btn.addEventListener('click', ()=>removeLeader(Number(btn.dataset.removeLeader)));
    });
  }
  async function loadAccessControl(){
    if(!accessControlStatus) return;
    setAccessStatus('A carregar permissoes e hierarquia...');
    const res = await fetch('/api/settings/access-control', { headers: authHeaders() });
    const data = await parseJson(res, 'Erro ao carregar permissoes');
    accessControlState = data;
    renderTeamLeaderSelect();
    renderPermissionMatrix();
    renderTeamHierarchy();
  }
  async function savePermissionPolicy(){
    if(!accessControlState || !permissionRole) return;
    const role = permissionRole.value || 'TEAM_LEADER';
    const current = accessControlState.policy.roles[role] || {};
    accessControlState.policy.roles[role] = Object.assign({}, current, {
      moduleAccess: selectedValues(modulePermissionList),
      informationAccess: selectedValues(infoPermissionList),
    });
    setAccessStatus('A gravar permissoes...');
    await withActionLock(`policy:${role}`, async ()=>{
      const res = await fetch('/api/settings/access-control/policy', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ policy: accessControlState.policy }),
      });
      const data = await parseJson(res, 'Erro ao gravar permissoes');
      accessControlState.policy = data.policy;
      renderPermissionMatrix();
      setAccessStatus('Permissoes gravadas.');
    });
  }
  async function saveTeamLeader(){
    if(!accessControlState || !teamLeaderSelect) return;
    const technicianId = Number(teamLeaderSelect.value || 0);
    if(!technicianId) return alert('Escolhe o tecnico que vai ficar como chefe de equipa.');
    const tech = (accessControlState.technicians || []).find((item)=>item.id === technicianId) || {};
    const leaders = (accessControlState.hierarchy?.leaders || []).filter((leader)=>leader.technicianId !== technicianId);
    leaders.push({
      id: `leader-${technicianId}`,
      technicianId,
      name: tech.name || `Tecnico ${technicianId}`,
      zone: teamLeaderZone?.value || tech.zone || '',
      technicianIds: parseIds(teamLeaderTechnicians?.value || ''),
      poolIds: parseIds(teamLeaderPools?.value || ''),
      active: true,
      notes: teamLeaderNotes?.value || '',
    });
    const hierarchy = Object.assign({}, accessControlState.hierarchy || {}, { leaders });
    setAccessStatus('A gravar chefe de equipa...');
    await withActionLock(`leader:${technicianId}`, async ()=>{
      const res = await fetch('/api/settings/access-control/hierarchy', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ hierarchy }),
      });
      const data = await parseJson(res, 'Erro ao gravar hierarquia');
      accessControlState.hierarchy = data.hierarchy;
      renderTeamHierarchy();
      setAccessStatus('Chefe de equipa gravado. O perfil do tecnico passa a TEAM_LEADER.');
    });
  }
  async function removeLeader(index){
    if(!accessControlState) return;
    if(!confirm('Remover este chefe de equipa da hierarquia?')) return;
    const leaders = (accessControlState.hierarchy?.leaders || []).filter((_, i)=>i !== index);
    const hierarchy = Object.assign({}, accessControlState.hierarchy || {}, { leaders });
    await withActionLock(`remove-leader:${index}`, async ()=>{
      const res = await fetch('/api/settings/access-control/hierarchy', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ hierarchy }),
      });
      const data = await parseJson(res, 'Erro ao remover');
      accessControlState.hierarchy = data.hierarchy;
      renderTeamHierarchy();
      setAccessStatus('Chefe de equipa removido da hierarquia.');
    }).catch((err)=>alert(err.message));
  }
  document.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener('change',()=>save(el.dataset.setting, el.checked)));
  if(backupNow) backupNow.addEventListener('click', createBackupNow);
  if(copyRollbackPath) copyRollbackPath.addEventListener('click', copyGuidePath);
  if(uploadUpgradeZip) uploadUpgradeZip.addEventListener('click', uploadZipPackage);
  if(rollbackUpgrade) rollbackUpgrade.addEventListener('click', rollbackToPrevious);
  if(permissionRole) permissionRole.addEventListener('change', renderPermissionMatrix);
  if(savePermissionPolicyButton) savePermissionPolicyButton.addEventListener('click', ()=>savePermissionPolicy().catch((err)=>{ setAccessStatus(err.message); alert(err.message); }));
  if(saveTeamLeaderButton) saveTeamLeaderButton.addEventListener('click', ()=>saveTeamLeader().catch((err)=>{ setAccessStatus(err.message); alert(err.message); }));
  load().catch(err=>status.textContent=err.message);
  loadPending().catch(err=>pendingList.textContent=err.message);
  loadReleaseSafety().catch(err=>{ if(releaseStatus) releaseStatus.textContent = err.message; });
  loadAccessControl().catch(err=>{ setAccessStatus(err.message); });
})();

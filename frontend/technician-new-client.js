(function(){
  const box = document.getElementById('permissionBox');
  const form = document.getElementById('form');
  const result = document.getElementById('result');
  const techId = localStorage.getItem('technicianId') || localStorage.getItem('cw_technician_id') || '';
  document.getElementById('technicianId').value = techId;

  async function checkPermission(){
    try{
      const res = await fetch('/api/technician-intake/settings');
      const data = await res.json();
      if(data.techniciansCanCreateClientsPools){
        box.className='notice ok';
        box.textContent = data.requireAdminReview ? 'Permissão ativa. As fichas criadas pelo técnico ficam pendentes para validação do administrador.' : 'Permissão ativa. As fichas criadas ficam imediatamente ativas.';
        form.classList.remove('hidden');
      }else{
        box.className='notice';
        box.textContent='Esta função está desligada na Central de Configurações. Pede ao administrador para ativar se for necessário.';
      }
    }catch(err){ box.textContent='Erro ao verificar permissões: '+err.message; }
  }

  document.getElementById('gpsBtn').addEventListener('click',()=>{
    if(!navigator.geolocation){ alert('GPS não disponível neste aparelho.'); return; }
    navigator.geolocation.getCurrentPosition((pos)=>{
      form.latitude.value = pos.coords.latitude;
      form.longitude.value = pos.coords.longitude;
      alert('Localização guardada nesta ficha.');
    },()=>alert('Não foi possível obter localização.'));
  });

  form.addEventListener('submit',async(ev)=>{
    ev.preventDefault();
    result.className='notice'; result.textContent='A guardar...';
    const payload = Object.fromEntries(new FormData(form).entries());
    try{
      const res = await fetch('/api/technician-intake/client-with-pool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Erro ao guardar');
      result.className='notice ok';
      result.innerHTML=`Ficha criada com sucesso. Cliente #${data.client.id}, Piscina #${data.pool.id}. Estado: ${data.pendingReview ? 'pendente de validação admin' : 'ativo'}.`;
      form.reset();
    }catch(err){ result.className='notice'; result.textContent=err.message; }
  });

  checkPermission();
})();

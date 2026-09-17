// Existing work can be consulted without inventing capacity or delay forecasts.
async function loadAISuggestions() {
  const box=document.getElementById('aiSuggestions');
  if (!box) return;
  const description=document.createElement('p'),link=document.createElement('a');
  description.textContent='Consulte as visitas planeadas e a atribuição atual. A disponibilidade da equipa e os tempos de deslocação precisam de confirmação.';
  link.href='/profit-map';link.textContent='Consultar trabalho planeado';
  box.replaceChildren(description,link);
}

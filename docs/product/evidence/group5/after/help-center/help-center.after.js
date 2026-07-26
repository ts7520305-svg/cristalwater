(function(){
  const topics = window.CRISTAL_HELP_TOPICS || {};
  const params = new URLSearchParams(window.location.search);
  let selected = params.get("topic") || "help";

  function escapeHtml(value){
    return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function renderTopics(){
    const q = String(document.getElementById("search")?.value || "").toLowerCase();
    const box = document.getElementById("topics");
    const entries = Object.entries(topics).filter(([key])=>key !== "default");
    box.innerHTML = entries.filter(([key, topic])=>{
      const text = `${key} ${topic.title} ${topic.summary} ${topic.detail} ${(topic.actions || []).join(" ")}`.toLowerCase();
      return !q || text.includes(q);
    }).map(([key, topic])=>`
      <button class="topic ${key === selected ? "active" : ""}" data-topic="${escapeHtml(key)}">
        <strong>${escapeHtml(topic.title)}</strong>
        <small>${escapeHtml(topic.summary)}</small>
      </button>
    `).join("");
    box.querySelectorAll("[data-topic]").forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        selected = btn.dataset.topic;
        history.replaceState(null, "", `/help-center?topic=${encodeURIComponent(selected)}`);
        render();
      });
    });
  }

  function renderDetail(){
    const topic = topics[selected] || topics.help || topics.default;
    const actions = (topic.actions || []).map((a)=>`<li>${escapeHtml(a)}</li>`).join("");
    document.getElementById("detail").innerHTML = `
      <h2>${escapeHtml(topic.title)}</h2>
      <p><b>Resumo:</b> ${escapeHtml(topic.summary)}</p>
      <p>${escapeHtml(topic.detail)}</p>
      ${actions ? `<h3>Ações principais</h3><ul>${actions}</ul>` : ""}
      <h3>Como usar na prática</h3>
      <p>Começa por abrir o módulo, confirma os dados principais no topo do ecrã, executa a ação pretendida e valida se ficou refletida no dashboard/timeline. Em caso de dúvida, usa o botão de ajuda no canto inferior direito ou o comando rápido.</p>
    `;
  }

  function render(){
    renderTopics();
    renderDetail();
  }

  document.getElementById("search")?.addEventListener("input", renderTopics);
  render();
})();

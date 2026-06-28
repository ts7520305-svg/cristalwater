// ======================================================
// IA OPERACIONAL
// ======================================================

async function loadAISuggestions(){

  try {

    const res =
      await fetch(
        `${API}/routes/auto-plan`
      );

    const data =
      await res.json();

    const box =
      document.getElementById(
        "aiSuggestions"
      );

    if (!box) return;

    box.innerHTML = "";

    // ==================================================
    // REDISTRIBUIÇÃO
    // ==================================================

    const overloadedTechs = [];

    const freeTechs = [];

    // ==================================================
    // ZONAS
    // ==================================================

    const zones = {};

    let hasSuggestions = false;

    // ==================================================
    // ANALISAR PLANOS
    // ==================================================

    (data.plans || []).forEach(plan => {

      const a =
        plan.analytics;

      if (!a) return;

      // ==================================================
      // ANALISAR CARGA
      // ==================================================

      if (a.overloaded){

        overloadedTechs.push({
          name: plan.technician.name,
          minutes: a.totalMinutes
        });
      }

      if (a.totalMinutes <= 180){

        freeTechs.push({
          name: plan.technician.name,
          minutes: a.totalMinutes
        });
      }

      // ==================================================
      // ANALISAR ZONAS
      // ==================================================

      plan.route.forEach(r => {

        const z =
          r.zone || "Sem zona";

        if (!zones[z]){

          zones[z] = {

            totalMinutes:0,

            priority:0,

            extras:0
          };
        }

        zones[z].totalMinutes +=
          r.estimatedMinutes || 0;

        if (
          r.priorityScore >= 500
        ){

          zones[z].priority++;
        }

        if (
          r.type === "EXTRA"
        ){

          zones[z].extras++;
        }
      });

      // ==================================================
      // SOBRECARREGADO
      // ==================================================

      if (a.overloaded){

        hasSuggestions = true;

        box.innerHTML += `

          <div class="ai-card">

            🚨 Técnico
            <b>${plan.technician.name}</b>

            sobrecarregado

            (${a.totalMinutes} min)

          </div>

        `;
      }

      // ==================================================
      // PREVISÃO ATRASO
      // ==================================================

      if (a.totalMinutes >= 480){

        hasSuggestions = true;

        box.innerHTML += `

          <div class="ai-card">

            ⏰ IA prevê que

            <b>${plan.technician.name}</b>

            poderá não terminar a ronda
            a tempo

          </div>

        `;
      }

      // ==================================================
      // MUITOS EXTRAS
      // ==================================================

      if (a.extras >= 3){

        hasSuggestions = true;

        box.innerHTML += `

          <div class="ai-card">

            🟠 Técnico
            <b>${plan.technician.name}</b>

            com muitos extras

            (${a.extras})

          </div>

        `;
      }

      // ==================================================
      // MUITAS PRIORIDADES
      // ==================================================

      if (a.priorityPools >= 4){

        hasSuggestions = true;

        box.innerHTML += `

          <div class="ai-card">

            🔴 Técnico
            <b>${plan.technician.name}</b>

            com demasiadas piscinas prioritárias

          </div>

        `;
      }

      // ==================================================
      // DISPONÍVEL
      // ==================================================

      if (a.totalMinutes <= 180){

        hasSuggestions = true;

        box.innerHTML += `

          <div class="ai-card">

            🟢 Técnico
            <b>${plan.technician.name}</b>

            disponível para ajudar

          </div>

        `;
      }
    });

    // ======================================================
    // IA REDISTRIBUIÇÃO
    // ======================================================

    if (
      overloadedTechs.length &&
      freeTechs.length
    ){

      overloadedTechs.forEach(o => {

        freeTechs.forEach(f => {

          hasSuggestions = true;

          box.innerHTML += `

            <div class="ai-card">

              🔄 IA sugere redistribuir
              trabalho de

              <b>${o.name}</b>

              para

              <b>${f.name}</b>

            </div>

          `;
        });
      });
    }

    // ======================================================
    // IA ZONAS
    // ======================================================

    Object.entries(zones)
      .forEach(([zone,data]) => {

        if (
          data.totalMinutes >= 600
        ){

          hasSuggestions = true;

          box.innerHTML += `

            <div class="ai-card">

              🚨 Zona
              <b>${zone}</b>

              sobrecarregada

            </div>

          `;
        }

        if (
          data.priority >= 5
        ){

          hasSuggestions = true;

          box.innerHTML += `

            <div class="ai-card">

              🔴 Zona
              <b>${zone}</b>

              com demasiadas prioridades

            </div>

          `;
        }

        if (
          data.extras >= 4
        ){

          hasSuggestions = true;

          box.innerHTML += `

            <div class="ai-card">

              🟠 Zona
              <b>${zone}</b>

              com excesso de extras

            </div>

          `;
        }
    });

    // ======================================================
    // TUDO OK
    // ======================================================

    if (!hasSuggestions){

      box.innerHTML = `

        <div class="ai-card">

          ✅ Operação equilibrada

        </div>

      `;
    }

  } catch(err){

    console.error(err);
  }
}
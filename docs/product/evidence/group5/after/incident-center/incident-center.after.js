const API =
  "/api";

// ======================================================
// AUTH
// ======================================================

const token =
  localStorage.getItem("token");

const user =
  JSON.parse(
    localStorage.getItem("user") || "{}"
  );

// ======================================================
// SOCKET
// ======================================================

const socket =
  io();

// ======================================================
// STATE
// ======================================================

let incidents = [];

let timeline = [];

// ======================================================
// HELPERS
// ======================================================

function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getHeaders(){

  return {
    Authorization:
      `Bearer ${token}`
  };
}

function logout(){

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "/login";
}

// ======================================================
// SLA
// ======================================================

function getRemainingSla(incident){

  if(!incident.slaDeadline)
    return null;

  const now =
    Date.now();

  const deadline =
    new Date(
      incident.slaDeadline
    ).getTime();

  return Math.floor(
    (deadline - now) / 1000 / 60
  );
}

function getSlaPercentage(incident){

  if(!incident.slaDeadline)
    return 0;

  const created =
    new Date(
      incident.createdAt
    ).getTime();

  const deadline =
    new Date(
      incident.slaDeadline
    ).getTime();

  const now =
    Date.now();

  const total =
    deadline - created;

  const current =
    now - created;

  if(total <= 0)
    return 100;

  let percent =
    (current / total) * 100;

  if(percent < 0)
    percent = 0;

  if(percent > 100)
    percent = 100;

  return Math.floor(percent);
}

function getSlaColor(percent){

  if(percent >= 90)
    return "#dc2626";

  if(percent >= 60)
    return "#ea580c";

  return "#16a34a";
}

// ======================================================
// LOAD INCIDENTS
// ======================================================

async function loadIncidents(){

  try {

    const res =
      await fetch(
        `${API}/incidents`,
        {
          headers:getHeaders()
        }
      );

    if(res.status === 401){

      logout();

      return;
    }

    const data =
      await res.json();

    incidents =
      data.incidents || [];

    renderDashboard();

    renderIncidents();

  } catch(err){

    console.error(err);
  }
}

// ======================================================
// KPI
// ======================================================

function renderDashboard(){

  const critical =
    incidents.filter(i =>
      i.severity === "CRITICAL"
    ).length;

  const high =
    incidents.filter(i =>
      i.severity === "HIGH"
    ).length;

  const active =
    incidents.filter(i =>
      i.status !== "RESOLVED"
    ).length;

  const resolved =
    incidents.filter(i =>
      i.status === "RESOLVED"
    ).length;

  setText(
    "criticalCount",
    critical
  );

  setText(
    "highCount",
    high
  );

  setText(
    "activeCount",
    active
  );

  setText(
    "resolvedCount",
    resolved
  );
}

function setText(id,value){

  const el =
    document.getElementById(id);

  if(el){

    el.textContent =
      value;
  }
}

// ======================================================
// BADGES
// ======================================================

function severityBadge(severity){

  const s =
    String(severity || "")
      .toUpperCase();

  const cls =
    s === "CRITICAL"
      ? "badge-critical"
      : s === "HIGH"
        ? "badge-high"
        : s === "MEDIUM"
          ? "badge-medium"
          : "badge-low";

  return `

    <div class="badge ${cls}">
      ${escapeHtml(s)}
    </div>

  `;
}

// ======================================================
// INCIDENTS
// ======================================================

function renderIncidents(){

  const box =
    document.getElementById(
      "incidentList"
    );

  if(!box) return;

  if(!incidents.length){

    box.innerHTML = `

      <div class="incident incident-low">

        ✅ Sem incidentes ativos.

      </div>

    `;

    return;
  }

  box.innerHTML =
    incidents.map(i => {

      const severity =
        String(i.severity || "")
          .toLowerCase();

      const slaPercent =
        getSlaPercentage(i);

      const slaRemaining =
        getRemainingSla(i);

      return `

        <div class="incident incident-${severity}">

          <h3>

            ${escapeHtml(i.title)}

          </h3>

          <div>

            ${escapeHtml(i.description || "")}

          </div>

          <!-- BADGES -->

          <div class="badges">

            ${severityBadge(i.severity)}

            <div class="badge badge-sla">

              SLA:
              ${
                slaRemaining == null
                  ? "-"
                  : slaRemaining <= 0
                    ? "VENCIDO"
                    : `${slaRemaining}m`
              }

            </div>

            ${
              i.escalated

              ? `

                <div class="badge badge-escalated">

                  ESCALATED

                </div>

              `

              : ""
            }

          </div>

          <!-- META -->

          <div class="incident-meta">

            Estado:
            <b>${escapeHtml(i.status)}</b>

            <br>

            Impact:
            <b>${i.impactScore}</b>

            <br>

            Priority:
            <b>${i.priorityScore}</b>

            <br>

            Origem:
            <b>${escapeHtml(i.source)}</b>

            <br>

            ${
              i.createdAt
                ? new Date(i.createdAt)
                    .toLocaleString("pt-PT")
                : ""
            }

          </div>

          <!-- SLA -->

          <div class="sla-container">

            <div class="sla-bar">

              <div
                class="sla-progress"
                style="
                  width:${slaPercent}%;
                  background:${getSlaColor(slaPercent)}
                "
              ></div>

            </div>

          </div>

          <!-- ACTIONS -->

          <div class="incident-actions">

            ${
              i.status !== "RESOLVED"

              ? `

                <button
                  class="btn-resolve"
                  onclick="resolveIncident(${i.id})"
                >

                  Resolver

                </button>

              `

              : ""
            }

            ${
              !i.escalated

              ? `

                <button
                  class="btn-escalate"
                  onclick="escalateIncident(${i.id})"
                >

                  Escalar

                </button>

              `

              : ""
            }

          </div>

        </div>

      `;
    }).join("");
}

// ======================================================
// TIMELINE
// ======================================================

function addTimeline(title,message){

  timeline.unshift({

    title,

    message,

    createdAt:new Date()
  });

  timeline =
    timeline.slice(0,30);

  renderTimeline();
}

function renderTimeline(){

  const box =
    document.getElementById(
      "incidentTimeline"
    );

  if(!box) return;

  if(!timeline.length){

    box.innerHTML = `

      <div class="timeline-item">

        Sistema iniciado.

      </div>

    `;

    return;
  }

  box.innerHTML =
    timeline.map(item => `

      <div class="timeline-item">

        <b>
          ${escapeHtml(item.title)}
        </b>

        <div>
          ${escapeHtml(item.message)}
        </div>

        <div class="timeline-time">

          ${
            new Date(item.createdAt)
              .toLocaleString("pt-PT")
          }

        </div>

      </div>

    `).join("");
}

// ======================================================
// RESOLVE
// ======================================================

async function resolveIncident(id){

  try {

    await fetch(
      `${API}/incidents/status/${id}`,
      {

        method:"POST",

        headers:{
          ...getHeaders(),
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          status:"RESOLVED"
        })
      }
    );

    addTimeline(
      "Incidente resolvido",
      `Incidente #${id}`
    );

    loadIncidents();

  } catch(err){

    console.error(err);
  }
}

// ======================================================
// ESCALATE
// ======================================================

async function escalateIncident(id){

  try {

    await fetch(
      `${API}/incidents/escalate/${id}`,
      {

        method:"POST",

        headers:getHeaders()
      }
    );

    addTimeline(
      "Incidente escalado",
      `Incidente #${id}`
    );

    loadIncidents();

  } catch(err){

    console.error(err);
  }
}

// ======================================================
// SOCKET
// ======================================================

socket.on(
  "new-incident",
  incident => {

    addTimeline(
      "Novo incidente",
      incident.title
    );

    loadIncidents();
  }
);

socket.on(
  "incident-updated",
  incident => {

    addTimeline(
      "Incidente atualizado",
      incident.title
    );

    loadIncidents();
  }
);

socket.on(
  "incident-escalated",
  incident => {

    addTimeline(
      "Incidente escalado",
      incident.title
    );

    loadIncidents();
  }
);

// ======================================================
// BUTTONS
// ======================================================

document
  .getElementById("refreshBtn")
  ?.addEventListener(
    "click",
    loadIncidents
  );

document
  .getElementById("dashboardBtn")
  ?.addEventListener(
    "click",
    ()=>{

      window.location.href =
        "/admin-dashboard";
    }
  );

document
  .getElementById("logoutBtn")
  ?.addEventListener(
    "click",
    logout
  );

// ======================================================
// AUTO REFRESH
// ======================================================

setInterval(()=>{

  renderIncidents();

},30000);

// ======================================================
// INIT
// ======================================================

window.addEventListener(
  "load",
  ()=>{

    if(
      !token ||
      !user ||
      user.role !== "ADMIN"
    ){

      logout();

      return;
    }

    renderTimeline();

    loadIncidents();
  }
);
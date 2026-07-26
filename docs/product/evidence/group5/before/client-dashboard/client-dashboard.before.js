const API = "/api";

function getClientId() {
	const userRaw = localStorage.getItem("user");
	let user = null;
	try { user = userRaw ? JSON.parse(userRaw) : null; } catch { user = null; }
	return Number(new URLSearchParams(location.search).get("clientId") || user?.clientId || user?.id || localStorage.getItem("cw_client_id") || localStorage.getItem("clientId") || 0);
}

function getAuthHeaders() {
	const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
	return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtDate(value) {
	if (!value) return "-";
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-PT");
}

function esc(value) {
	return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function loadDashboard() {
	const clientId = getClientId();
	if (!clientId) {
		document.getElementById("dashboardStatus").innerText = "Cliente não identificado.";
		return;
	}

	const [dashRes, notifRes] = await Promise.all([
		fetch(`${API}/client-portal/${clientId}/dashboard`, { headers: getAuthHeaders() }),
		fetch(`${API}/client-portal/${clientId}/notifications`, { headers: getAuthHeaders() }),
	]);

	const dashData = await dashRes.json().catch(() => ({}));
	const notifData = await notifRes.json().catch(() => ({}));

	if (!dashRes.ok || dashData.ok === false) {
		document.getElementById("dashboardStatus").innerText = dashData.error || "Não foi possível carregar o dashboard.";
		return;
	}

	const dashboard = dashData.dashboard || {};
	const poolStatus = Array.isArray(dashboard.poolStatus) ? dashboard.poolStatus : [];

	document.getElementById("dashboardStatus").innerText = "Atualizado";
	document.getElementById("poolStatusCard").innerHTML = poolStatus.length
		? poolStatus.map((pool) => `<div><b>${esc(pool.poolName || "Piscina")}</b><br><span>${esc(pool.status || "PLANNED")}</span></div>`).join("")
		: "Sem piscinas associadas.";
	document.getElementById("lastVisitCard").innerText = dashboard.lastVisit ? `${dashboard.lastVisit.poolName || "Piscina"} • ${fmtDate(dashboard.lastVisit.endAt || dashboard.lastVisit.plannedDate)}` : "Sem visitas registadas.";
	document.getElementById("nextVisitCard").innerText = dashboard.nextVisit ? `${dashboard.nextVisit.poolName || "Piscina"} • ${fmtDate(dashboard.nextVisit.plannedDate)}` : "Sem próxima visita planeada.";
	document.getElementById("technicianCard").innerText = dashboard.technicianAssigned || "A confirmar";
	document.getElementById("healthScoreCard").innerText = `${dashboard.healthScore ?? 0}/100`;

	const list = document.getElementById("dashboardNotifications");
	const notifications = Array.isArray(notifData.notifications) ? notifData.notifications.slice(0, 4) : [];
	if (!notifications.length) {
		list.innerHTML = `<div class="card"><p>Sem notificações recentes.</p></div>`;
		return;
	}
	list.innerHTML = notifications.map((notification) => `
		<div class="card">
			<h3>${esc(notification.title || "Notificação")}</h3>
			<p>${esc(notification.message || "")}</p>
			<p><small>${esc(fmtDate(notification.createdAt))}</small></p>
		</div>
	`).join("");
}

loadDashboard().catch((error) => {
	const node = document.getElementById("dashboardStatus");
	if (node) node.innerText = error.message || "Erro ao carregar dashboard.";
});
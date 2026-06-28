const API = "/api";

let currentClient = null;
let adminId = 1;

// ==========================================
// LOAD CHAT
// ==========================================

async function load() {
  const id = Number(document.getElementById("clientId").value);
  currentClient = id;

  const res = await fetch(`${API}/chat/client/${id}`);
  const data = await res.json();

  const container = document.getElementById("messages");
  container.innerHTML = "";

  data.messages.forEach(m => {
    const div = document.createElement("div");

    div.className = "msg " + (m.senderId === adminId ? "me" : "other");

    div.innerHTML = `
      ${m.text}
      <br><small>${new Date(m.createdAt).toLocaleString()}</small>
    `;

    container.appendChild(div);
  });
}

// ==========================================
// SEND
// ==========================================

async function send() {
  const text = document.getElementById("text").value;

  await fetch(`${API}/chat`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      senderId: adminId,
      receiverId: 0,
      text,
      chatType: "CLIENT",
      clientId: currentClient
    })
  });

  document.getElementById("text").value = "";
  load();
}
// ======================================================
// CLIENT AUTH GUARD
// ======================================================

const token =
  localStorage.getItem("token");

const userRaw =
  localStorage.getItem("user");

// ======================================================
// NO SESSION
// ======================================================

if (!token || !userRaw) {

  alert("Sessão expirada.");

  window.location.href =
    "/client-login";
}

// ======================================================
// PARSE USER
// ======================================================

let user = null;

try {

  user =
    JSON.parse(userRaw);

} catch(err){

  console.error(err);

  localStorage.clear();

  window.location.href =
    "/client-login";
}

// ======================================================
// VALIDATE ROLE
// ======================================================

if (!user || user.role !== "CLIENT") {

  alert("Acesso reservado ao cliente.");

  localStorage.clear();

  window.location.href =
    "/client-login";
}

const resolvedClientId = Number(user?.clientId || user?.id || 0);
if (resolvedClientId > 0) {
  localStorage.setItem("cw_client_id", String(resolvedClientId));
  localStorage.setItem("clientId", String(resolvedClientId));
}
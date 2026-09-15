const API =
  "/api";

// ======================================================
// ELEMENTOS
// ======================================================

const loginBtn =
  document.getElementById("loginBtn");

const errorBox =
  document.getElementById("error");

// ======================================================
// LOGIN CLIENTE
// ======================================================

let loginPending = false;
async function login(){
  if(loginPending) return;

  errorBox.textContent = "";

  const email =
    document.getElementById("email")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value;

  if(!email || !password){

    errorBox.textContent =
      "Preencha todos os campos.";

    return;
  }

  loginPending = true;
  try {

    loginBtn.disabled = true;

    loginBtn.textContent =
      "A entrar...";

    const res =
      await fetch(
        `${API}/client-auth/login`,
        {

          method:"POST",

          headers:{
            "Content-Type":"application/json"
          },

          body: JSON.stringify({
            email,
            password
          })
        }
      );

    const data =
      await res.json();

    if(!res.ok || !data.ok){

      errorBox.textContent =
        data.error || "Login inválido";

      loginBtn.disabled = false;

      loginBtn.textContent =
        "Entrar";

      return;
    }

    // ==================================================
    // VALIDAR CLIENT
    // ==================================================

    const baseUser = data.user || data.client || null;
    const sessionUser = baseUser ? {
      ...baseUser,
      role: "CLIENT",
      clientId: Number(baseUser.clientId || baseUser.id || data.client?.id || 0) || undefined,
    } : null;

    if(!sessionUser || (baseUser.role && baseUser.role !== "CLIENT") || !data.token || !Number.isSafeInteger(sessionUser.clientId) || sessionUser.clientId <= 0){

      errorBox.textContent =
        "Conta não é cliente.";

      loginBtn.disabled = false;

      loginBtn.textContent =
        "Entrar";

      return;
    }

    // ==================================================
    // SAVE SESSION
    // ==================================================

    if (window.CristalAuth) {
      await window.CristalAuth.persistSession(data.token, sessionUser);
    } else {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(sessionUser));
      localStorage.setItem("cristalwater_jwt", data.token);
      localStorage.setItem("cristalwater_user", JSON.stringify(sessionUser));
    }

    const clientId = Number(sessionUser.clientId || sessionUser.id || 0);
    localStorage.setItem("cw_client_id", String(clientId));
    localStorage.setItem("clientId", String(clientId));

    // ==================================================
    // REDIRECT
    // ==================================================

    window.location.href = window.CristalAuth?.invoiceReturnPath?.() || "/client-portal";

  } catch(err){

    console.error(err);

    errorBox.textContent =
      "Erro ligação servidor.";

  } finally {

    loginPending = false;

    loginBtn.disabled = false;

    loginBtn.textContent =
      "Entrar";
  }
}

// ======================================================
// EVENTS
// ======================================================

loginBtn.addEventListener(
  "click",
  login
);

document.addEventListener(
  "keydown",
  (e)=>{

    if(e.key === "Enter"){
      e.preventDefault();
      login();
    }
  }
);

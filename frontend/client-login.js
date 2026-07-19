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

async function login(){

  errorBox.textContent = "";

  const email =
    document.getElementById("email")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value
      .trim();

  if(!email || !password){

    errorBox.textContent =
      "Preencha todos os campos.";

    return;
  }

  try {

    loginBtn.disabled = true;

    loginBtn.textContent =
      "A entrar...";

    const res =
      await fetch(
        `${API}/auth/login`,
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

    const sessionUser = data.user || data.client || null;

    if(!sessionUser || sessionUser.role !== "CLIENT"){

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

    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(sessionUser)
    );

    const clientId = Number(sessionUser.clientId || sessionUser.id || data.client?.id || 0);
    if (clientId > 0) {
      localStorage.setItem("cw_client_id", String(clientId));
      localStorage.setItem("clientId", String(clientId));
    }

    if (window.CristalAuth) {
      window.CristalAuth.persistSession(data.token, sessionUser);
    } else {
      localStorage.setItem("cristalwater_jwt", data.token);
      localStorage.setItem("cristalwater_user", JSON.stringify(sessionUser));
    }

    // ==================================================
    // REDIRECT
    // ==================================================

    window.location.href =
      "/client-portal";

  } catch(err){

    console.error(err);

    errorBox.textContent =
      "Erro ligação servidor.";

  } finally {

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

      login();
    }
  }
);

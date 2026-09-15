const API =
  "/api";

const loginBtn =
  document.getElementById("loginBtn");

const errorBox =
  document.getElementById("error");

// ======================================================
// LOGIN ADMIN
// ======================================================

let loginPending = false;
async function login() {
  if(loginPending) return;

  errorBox.textContent = "";

  const email =
    document.getElementById("email")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value;

  if (!email || !password) {

    errorBox.textContent =
      "Preencha email e password.";

    return;
  }

  loginPending = true;
  try {

    loginBtn.disabled = true;

    loginBtn.textContent =
      "A entrar...";

    const res =
      await fetch(
        `${API}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            email,
            password
          })
        }
      );

    const data =
      await res.json();

    if (!res.ok || !data.ok) {

      errorBox.textContent =
        data.error || "Erro login";

      loginBtn.disabled = false;

      loginBtn.textContent =
        "Entrar";

      return;
    }

    // ==================================================
    // VALIDAR ADMIN
    // ==================================================

    if (!data.token || data.user?.role !== "ADMIN") {

      errorBox.textContent =
        "Acesso reservado ao administrador.";

      loginBtn.disabled = false;

      loginBtn.textContent =
        "Entrar";

      return;
    }

    // ==================================================
    // SAVE SESSION
    // ==================================================

    if (window.CristalAuth) {
      await window.CristalAuth.persistSession(data.token, data.user);
    } else {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("cristalwater_jwt", data.token);
      localStorage.setItem("cristalwater_user", JSON.stringify(data.user));
      localStorage.setItem("adminToken", data.token);
    }

    // ==================================================
    // REDIRECT
    // ==================================================

    window.location.href =
      "/admin-menu";

  } catch (err) {

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
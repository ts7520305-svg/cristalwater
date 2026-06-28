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
// LOGIN
// ======================================================

async function login(){

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
      "Preencha email e password.";

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

    console.log(
      "LOGIN RESPONSE:",
      data
    );

    if(!res.ok){

      errorBox.textContent =
        data.error || "Erro login";

      loginBtn.disabled = false;

      loginBtn.textContent =
        "Entrar";

      return;
    }

    // ==================================================
    // NORMALIZE ROLE
    // ==================================================

    const role =
      String(
        data.user?.role || ""
      )
      .toUpperCase()
      .trim();

    data.user.role =
      role;

    // ==================================================
    // SAVE SESSION
    // ==================================================

    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    if (window.CristalAuth) {
      window.CristalAuth.persistSession(data.token, data.user);
    } else {
      localStorage.setItem("cristalwater_jwt", data.token);
      localStorage.setItem("cristalwater_user", JSON.stringify(data.user));
      localStorage.setItem("adminToken", data.token);
    }

    console.log(
      "ROLE NORMALIZED:",
      role
    );

    // ==================================================
    // ADMIN
    // ==================================================

    if (role === "ADMIN"){

      window.location.href =
        "/admin-menu";

      return;
    }

    // ==================================================
    // CLIENT
    // ==================================================

    if (role === "CLIENT"){

      window.location.href =
        "/client-portal";

      return;
    }

    // ==================================================
    // TECHNICIAN
    // ==================================================

    if (role === "TECHNICIAN"){

      window.location.href =
        "/technician";

      return;
    }

    // ==================================================
    // UNKNOWN ROLE
    // ==================================================

    errorBox.textContent =
      `Tipo inválido: ${role}`;

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

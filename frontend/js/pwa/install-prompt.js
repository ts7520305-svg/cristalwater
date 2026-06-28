let deferredPrompt;

// ======================================================
// INSTALL PROMPT
// ======================================================

window.addEventListener(

  "beforeinstallprompt",

  (e)=>{

    e.preventDefault();

    deferredPrompt = e;

    const btn =
      document.getElementById(
        "installAppBtn"
      );

    if (btn){

      btn.style.display =
        "inline-flex";
    }
  }
);

// ======================================================
// INSTALL APP
// ======================================================

async function installApp(){

  if (!deferredPrompt)
    return;

  deferredPrompt.prompt();

  const result =
    await deferredPrompt.userChoice;

  console.log(
    result.outcome
  );

  deferredPrompt = null;

  const btn =
    document.getElementById(
      "installAppBtn"
    );

  if (btn){

    btn.style.display =
      "none";
  }
}
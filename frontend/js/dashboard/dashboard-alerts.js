// ======================================================
// ALERTS PANEL
// ======================================================

function addCriticalAlert(message){

  const box =
    document.getElementById(
      "criticalAlertsList"
    );

  if (!box) return;

  const div =
    document.createElement("div");

  div.className =
    "alert-card alert-high";

  div.innerHTML = `

    <div>

      🚨 ${message}

    </div>

    <div class="feed-time">

      ${
        new Date()
          .toLocaleTimeString("pt-PT")
      }

    </div>

  `;

  box.prepend(div);

  const counter =
    document.getElementById(
      "criticalAlerts"
    );

  if (counter){

    counter.innerText =
      Number(counter.innerText || 0) + 1;
  }

  // LIMITAR

  if (
    box.children.length > 20
  ){

    box.removeChild(
      box.lastChild
    );
  }
}
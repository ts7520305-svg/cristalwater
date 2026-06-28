// ======================================================
// PUSH NOTIFICATIONS
// ======================================================

async function initPushNotifications(){

  // ================================================
  // SUPPORTED
  // ================================================

  if (
    !("Notification" in window)
  ){

    console.log(
      "Push não suportado"
    );

    return;
  }

  // ================================================
  // PERMISSION
  // ================================================

  let permission =
    Notification.permission;

  if (
    permission !== "granted"
  ){

    permission =
      await Notification.requestPermission();
  }

  if (
    permission !== "granted"
  ){

    console.log(
      "Push recusado"
    );

    return;
  }

  console.log(
    "✅ Push ativo"
  );
}

// ======================================================
// LOCAL PUSH
// ======================================================

function showLocalNotification(
  title,
  body
){

  if (
    Notification.permission !== "granted"
  ) return;

  new Notification(title,{

    body,

    icon:"/icon-192.png"
  });
}
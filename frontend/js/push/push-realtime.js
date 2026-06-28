// ======================================================
// SOCKET PUSH REALTIME
// ======================================================

const pushSocket =
  io();

// ======================================================
// CONNECT
// ======================================================

pushSocket.on(
  "connect",
  ()=>{

    console.log(
      "🔔 Push realtime ativo"
    );
  }
);

// ======================================================
// NEW VISIT
// ======================================================

pushSocket.on(
  "new-visit",
  (data)=>{

    showLocalNotification(

      "Nova visita",

      `${data.pool} - ${data.client}`
    );
  }
);

// ======================================================
// ALERT
// ======================================================

pushSocket.on(
  "critical-alert",
  (data)=>{

    showLocalNotification(

      "🚨 Alerta crítico",

      data.message
    );
  }
);

// ======================================================
// MESSAGE
// ======================================================

pushSocket.on(
  "new-message",
  (data)=>{

    showLocalNotification(

      "💬 Nova mensagem",

      data.message
    );
  }
);

// ======================================================
// PAYMENT
// ======================================================

pushSocket.on(
  "payment-reminder",
  (data)=>{

    showLocalNotification(

      "💰 Pagamento",

      data.message
    );
  }
);
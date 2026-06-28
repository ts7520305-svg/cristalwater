// ======================================================
// OFFLINE QUEUE
// ======================================================

const OFFLINE_QUEUE_KEY =
  "cristalwater_offline_queue";

// ======================================================
// ADD
// ======================================================

function addOfflineAction(action){

  const queue =
    getOfflineQueue();

  queue.push({

    ...action,

    createdAt:
      new Date()
        .toISOString()
  });

  localStorage.setItem(

    OFFLINE_QUEUE_KEY,

    JSON.stringify(queue)
  );

  console.log(
    "📦 Offline action guardada"
  );
}

// ======================================================
// GET
// ======================================================

function getOfflineQueue(){

  try {

    return JSON.parse(

      localStorage.getItem(
        OFFLINE_QUEUE_KEY
      )

    ) || [];

  } catch {

    return [];
  }
}

// ======================================================
// CLEAR
// ======================================================

function clearOfflineQueue(){

  localStorage.removeItem(
    OFFLINE_QUEUE_KEY
  );
}

// ======================================================
// SYNC
// ======================================================

async function syncOfflineQueue(){

  if (!navigator.onLine)
    return;

  const queue =
    getOfflineQueue();

  if (!queue.length)
    return;

  console.log(
    "🔄 Sync offline..."
  );

  for (const item of queue){

    try {

      await fetch(
        item.url,
        {
          method:
            item.method || "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              item.body || {}
            )
        }
      );

    } catch(err){

      console.error(err);

      return;
    }
  }

  clearOfflineQueue();

  console.log(
    "✅ Offline sync concluído"
  );
}
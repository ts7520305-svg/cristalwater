// ======================================================
// OFFLINE QUEUE
// ======================================================

const OFFLINE_QUEUE_KEY =
  "cristalwater_offline_queue";

function buildOfflineActionKey(action = {}) {
  return String(
    action.syncKey ||
    action.idempotencyKey ||
    `${action.method || "POST"}:${action.url || ""}:${JSON.stringify(action.body || {})}`
  );
}

// ======================================================
// ADD
// ======================================================

function addOfflineAction(action){

  const queue =
    getOfflineQueue();

  const nextKey = buildOfflineActionKey(action);
  const nextAction = {
    ...action,
    syncKey: action.syncKey || nextKey,
    createdAt: new Date().toISOString(),
  };

  const existingIndex = queue.findIndex((item) => buildOfflineActionKey(item) === nextKey);

  if (existingIndex >= 0) {
    queue[existingIndex] = nextAction;
  } else {
    queue.push(nextAction);
  }

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

  const remaining = [];

  for (const item of queue){

    try {

      const response = await fetch(
        item.url,
        {
          method:
            item.method || "POST",

          headers: {
            "Content-Type":
              "application/json",
            ...(item.headers || {})
          },

          body:
            JSON.stringify(
              item.body || {}
            )
        }
      );

      const responseBody =
        await response.clone().json().catch(() => ({}));

      if (response.ok) {
        continue;
      }

      const responseText = String(responseBody?.error || responseBody?.message || "");
      const isCompletedConflict =
        response.status === 409 && (
          responseBody?.code === "VISIT_ALREADY_COMPLETED" ||
          /ja foi conclu[ií]da|already completed/i.test(responseText)
        );

      if (isCompletedConflict) {
        continue;
      }

      remaining.push({
        ...item,
        syncError: responseBody?.error || responseBody?.message || `HTTP_${response.status}`,
      });

    } catch(err){

      console.error(err);

      remaining.push(item);
      break;
    }
  }

  localStorage.setItem(
    OFFLINE_QUEUE_KEY,
    JSON.stringify(remaining)
  );

  if (!remaining.length) {
    console.log(
      "✅ Offline sync concluído"
    );
  }
}
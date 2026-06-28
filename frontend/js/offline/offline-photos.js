const OFFLINE_PHOTOS_KEY =
  "cristalwater_offline_photos";

// ======================================================
// GET
// ======================================================

function getOfflinePhotos(){

  try {

    return JSON.parse(

      localStorage.getItem(
        OFFLINE_PHOTOS_KEY
      )

    ) || [];

  } catch {

    return [];
  }
}

// ======================================================
// SAVE
// ======================================================

function saveOfflinePhoto(photo){

  const photos =
    getOfflinePhotos();

  photos.push(photo);

  localStorage.setItem(

    OFFLINE_PHOTOS_KEY,

    JSON.stringify(photos)
  );

  console.log(
    "📸 Foto offline guardada"
  );
}

// ======================================================
// CLEAR
// ======================================================

function clearOfflinePhotos(){

  localStorage.removeItem(
    OFFLINE_PHOTOS_KEY
  );
}

// ======================================================
// SYNC
// ======================================================

async function syncOfflinePhotos(){

  if (!navigator.onLine)
    return;

  const photos =
    getOfflinePhotos();

  if (!photos.length)
    return;

  console.log(
    "🔄 Sync fotos offline..."
  );

  const remaining = [];

  for (const p of photos){

    try {

      const formData =
        new FormData();

      formData.append(
        "photo",
        dataURLtoBlob(p.base64),
        "offline.jpg"
      );

      formData.append(
        "type",
        p.type
      );

      const res =
        await fetch(
          `${API}/visits/${p.visitId}/photo`,
          {
            method:"POST",
            body: formData
          }
        );

      if (!res.ok){

        remaining.push(p);
      }

    } catch(err){

      console.error(err);

      remaining.push(p);
    }
  }

  localStorage.setItem(

    OFFLINE_PHOTOS_KEY,

    JSON.stringify(remaining)
  );

  console.log(
    "✅ Sync fotos concluído"
  );
}

// ======================================================
// DATAURL TO BLOB
// ======================================================

function dataURLtoBlob(dataURL){

  const arr =
    dataURL.split(",");

  const mime =
    arr[0].match(/:(.*?);/)[1];

  const bstr =
    atob(arr[1]);

  let n =
    bstr.length;

  const u8arr =
    new Uint8Array(n);

  while(n--){

    u8arr[n] =
      bstr.charCodeAt(n);
  }

  return new Blob(
    [u8arr],
    { type:mime }
  );
}
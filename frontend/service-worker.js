const CACHE_NAME =
  "cristalwater-v1";

// ======================================================
// FICHEIROS CACHE
// ======================================================

const urlsToCache = [

  "/",

  "/technician",

  "/visit",

  "/frontend/technician.js",

  "/frontend/technician-visit.js",

  "/frontend/admin-dashboard.js",

  "/frontend/js/dashboard/dashboard-core.js",

  "/frontend/js/dashboard/dashboard-map.js",

  "/frontend/js/dashboard/dashboard-feed.js",

  "/frontend/js/dashboard/dashboard-alerts.js",

  "/frontend/js/dashboard/dashboard-ai.js",

  "/manifest.json"
];

// ======================================================
// INSTALL
// ======================================================

self.addEventListener(
  "install",
  (event) => {

    event.waitUntil(

      caches.open(CACHE_NAME)

        .then((cache) => {

          return cache.addAll(
            urlsToCache
          );
        })
    );
  }
);

// ======================================================
// FETCH
// ======================================================

self.addEventListener(
  "fetch",
  (event) => {

    event.respondWith(

      caches.match(
        event.request
      )

      .then((response) => {

        // CACHE

        if (response){

          return response;
        }

        // NETWORK

        return fetch(
          event.request
        );
      })
    );
  }
);

// ======================================================
// ACTIVATE
// ======================================================

self.addEventListener(
  "activate",
  (event) => {

    event.waitUntil(

      caches.keys()

        .then((keys) => {

          return Promise.all(

            keys.map((key) => {

              if (
                key !== CACHE_NAME
              ){

                return caches.delete(
                  key
                );
              }
            })
          );
        })
    );
  }
);
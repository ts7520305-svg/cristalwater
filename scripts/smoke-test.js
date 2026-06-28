const BASE =
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3002}`;

const endpoints = [
  "/api/system/health",
  "/api/system/version",
  "/api/system/modules",
  "/api/dashboard/metrics",
  "/api/core/dashboard",
  "/api/gps/live"
];

async function test(){

  console.log("Cristal Water smoke test");
  console.log("Base:", BASE);

  for (const endpoint of endpoints){

    try {

      const res =
        await fetch(BASE + endpoint);

      const text =
        await res.text();

      console.log(
        res.ok ? "OK" : "FAIL",
        endpoint,
        res.status,
        text.slice(0,120)
      );

    } catch(err){

      console.log(
        "ERROR",
        endpoint,
        err.message
      );
    }
  }
}

test();

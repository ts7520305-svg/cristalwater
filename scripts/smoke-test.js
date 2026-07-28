const BASE =
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3002}`;

const endpoints = [
  { path: "/api/system/health", expected: [200] },
  { path: "/api/system/version", expected: [200] },
  { path: "/api/system/modules", expected: [200] },
  { path: "/api/dashboard/metrics", expected: [200, 401, 403] },
  { path: "/api/core/dashboard", expected: [200, 401, 403] },
  { path: "/api/gps/live", expected: [200, 401, 403] }
];

async function test(){

  console.log("Cristal Water smoke test");
  console.log("Base:", BASE);

  let failed = false;

  for (const endpoint of endpoints){

    try {

      const res =
        await fetch(BASE + endpoint.path);

      const text =
        await res.text();

      const pass = endpoint.expected.includes(res.status);
      if (!pass) failed = true;

      console.log(
        pass ? "OK" : "FAIL",
        endpoint.path,
        res.status,
        text.slice(0,120)
      );

    } catch(err){

      failed = true;

      console.log(
        "ERROR",
        endpoint.path,
        err.message
      );
    }
  }

  if (failed) process.exitCode = 1;
}

test();

const http = require("http");

const BASE = "http://127.0.0.1:3002";

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;

    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";

        res.on("data", (chunk) => {
          raw += chunk;
        });

        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode,
              body: raw ? JSON.parse(raw) : null,
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);

    if (data) req.write(data);

    req.end();
  });
}

async function main() {
  const client = await request("POST", "/api/business/clients", {
    name: "Smoke Client",
    email: "smoke@cristalwater.pt",
  });

  const pool = await request("POST", "/api/business/pools", {
    clientId: client.body.client.id,
    name: "Smoke Pool",
    volumeM3: 45,
  });

  const technician = await request("POST", "/api/business/technicians", {
    name: "Smoke Tech",
    email: "tech@cristalwater.pt",
  });

  const visit = await request("POST", "/api/business/visits", {
    clientId: client.body.client.id,
    poolId: pool.body.pool.id,
    technicianId: technician.body.technician.id,
  });

  const billing = await request("POST", "/api/business/billing", {
    clientId: client.body.client.id,
    poolId: pool.body.pool.id,
    description: "Smoke Billing",
    amount: 80,
  });

  const pay = await request("POST", `/api/business/billing/${billing.body.billing.id}/pay`);

  const summary = await request("GET", "/api/business/summary");

  const ok =
    client.status === 201 &&
    pool.status === 201 &&
    technician.status === 201 &&
    visit.status === 201 &&
    billing.status === 201 &&
    pay.status === 200 &&
    summary.status === 200 &&
    summary.body.ok === true;

  console.log(JSON.stringify({
    ok,
    service: "BusinessApiSmokeTest",
    summary: summary.body,
    checkedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

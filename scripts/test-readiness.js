const fs = require("fs");
const path = require("path");
const required = ["src/server.js","prisma/schema.prisma","frontend/admin-dashboard.html","frontend/admin-ai.html","frontend/admin-crm.html","frontend/admin-suppliers.html","frontend/admin-security.html","frontend/admin-test-center.html","frontend/manifest.webmanifest","frontend/sw.js"];
let ok = true;
for (const file of required) { const exists = fs.existsSync(path.join(__dirname, "..", file)); console.log(`${exists ? "OK" : "MISSING"} ${file}`); if (!exists) ok = false; }
const schema = fs.readFileSync(path.join(__dirname,"..","prisma/schema.prisma"),"utf8");
for (const model of ["Lead","Appointment","GeneralReminder","SupplierAccount","SupplierQuickLink","UserAuditLog"]) { const exists = schema.includes(`model ${model}`); console.log(`${exists ? "OK" : "MISSING"} Prisma model ${model}`); if (!exists) ok = false; }
process.exit(ok ? 0 : 1);

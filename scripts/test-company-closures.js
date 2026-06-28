const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const checks = [
  ['schema CompanyClosure', 'prisma/schema.prisma', /model CompanyClosure/],
  ['route file', 'src/routes/companyClosureRoutes.js', /router\.post\("\/"/],
  ['server mount', 'src/server.js', /\/api\/company-closures/],
  ['frontend html', 'frontend/admin-company-closures.html', /Modo Férias/],
  ['frontend js', 'frontend/admin-company-closures.js', /generate-notifications/],
  ['notification integration', 'src/routes/companyClosureRoutes.js', /COMPANY_CLOSURE_CLIENT_NOTICE/],
  ['route impact preview', 'src/routes/companyClosureRoutes.js', /route-impact/],
  ['templates', 'src/routes/companyClosureRoutes.js', /NATAL/],
];

let failed = 0;
for (const [name, rel, pattern] of checks) {
  const file = path.join(root, rel);
  const ok = fs.existsSync(file) && pattern.test(fs.readFileSync(file, 'utf8'));
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) failed++;
}

for (const rel of ['src/routes/companyClosureRoutes.js', 'frontend/admin-company-closures.js']) {
  const file = path.join(root, rel);
  try {
    new Function(fs.readFileSync(file, 'utf8'));
    console.log(`✅ syntax ${rel}`);
  } catch (err) {
    console.log(`❌ syntax ${rel}: ${err.message}`);
    failed++;
  }
}

if (failed) {
  console.error(`Company closure test failed: ${failed}`);
  process.exit(1);
}
console.log('Company closure module OK.');

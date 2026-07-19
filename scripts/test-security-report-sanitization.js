const fs = require("fs");
const path = require("path");

function latestSecureAuthMatrixReport(reportsDir) {
  const files = fs.readdirSync(reportsDir)
    .filter((name) => /^secure-auth-matrix-.*\.json$/.test(name))
    .sort();
  if (!files.length) return null;
  return path.join(reportsDir, files[files.length - 1]);
}

function scanSensitive(text) {
  const patterns = [
    { id: "jwt", re: /[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}/g },
    { id: "bearer", re: /Bearer\s+[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}/gi },
    { id: "authorization_header", re: /authorization\s*:\s*bearer\s+/gi },
    { id: "password_kv", re: /"?password"?\s*:\s*"[^\"]+"/gi },
    { id: "pin_kv", re: /"?pin"?\s*:\s*"?\d{4,}"?/gi },
  ];

  const findings = [];
  for (const pattern of patterns) {
    if (pattern.re.test(text)) findings.push(pattern.id);
  }
  return findings;
}

function main() {
  const reportsDir = path.resolve(__dirname, "..", "reports");
  if (!fs.existsSync(reportsDir)) {
    console.error("REPORT_SANITIZATION_FAIL reports-dir-missing");
    process.exit(1);
  }

  const latest = latestSecureAuthMatrixReport(reportsDir);
  if (!latest) {
    console.error("REPORT_SANITIZATION_FAIL secure-auth-matrix-report-missing");
    process.exit(1);
  }

  const text = fs.readFileSync(latest, "utf8");
  const findings = scanSensitive(text);
  console.log(`REPORT_SANITIZATION_TARGET ${latest}`);
  console.log(`REPORT_SANITIZATION_FINDINGS ${findings.length}`);

  if (findings.length > 0) {
    console.error(`REPORT_SANITIZATION_FAIL ${findings.join(",")}`);
    process.exit(1);
  }

  console.log("REPORT_SANITIZATION_PASS true");
}

main();

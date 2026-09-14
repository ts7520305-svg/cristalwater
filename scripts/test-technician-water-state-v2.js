const fs = require("fs");
const path = require("path");
const assert = require("assert");

const shellPath = path.join(__dirname, "..", "frontend", "crystal-os-v2-shell.js");
const source = fs.readFileSync(shellPath, "utf8");

function has(text) {
  return source.includes(text);
}

assert(has("installTechnicianWaterUx"), "water UX installer missing");
assert(has("waterFlowState"), "water flow selector missing");
assert(has("A pingar"), "drip flow label missing");
assert(has("Meia aberta"), "half-open flow label missing");
assert(has("Totalmente aberta"), "full-open flow label missing");
assert(has("Água aberta há"), "elapsed open-water label missing");
assert(has("Confirma que a torneira está totalmente fechada?"), "explicit close confirmation missing");
assert(has("cwWaterReminders:"), "technician-scoped persistence missing");
assert(has("syncPendingWaterState"), "offline retry missing");
assert(has("/api/technician/water-reminders"), "backend contract not reused");
assert(has("event.stopImmediatePropagation()"), "legacy manual-timer action is not intercepted");
assert(has("node.hidden = true"), "legacy manual timing fields are not hidden");

console.log("PASS technician water-state v2 contract");

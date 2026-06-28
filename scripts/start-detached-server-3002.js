const childProcess = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const nodePath = "C:\\Program Files\\nodejs\\node.exe";
const code = "require('./src/server.js'); setInterval(function(){}, 1000);";

const child = childProcess.spawn(nodePath, ["-e", code], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: false
});

child.unref();
console.log(child.pid);

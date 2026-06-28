const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "../../logs");

function ensureLogDir(){
  if (!fs.existsSync(LOG_DIR)){
    fs.mkdirSync(LOG_DIR, { recursive:true });
  }
}

function writeLog(type, payload){
  try {
    ensureLogDir();

    const file = path.join(
      LOG_DIR,
      `${type}-${new Date().toISOString().slice(0,10)}.log`
    );

    const line = JSON.stringify({
      type,
      at:new Date().toISOString(),
      ...payload
    }) + "\n";

    fs.appendFileSync(file, line);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("LOGGER_WRITE_SKIPPED", err.message);
    }
  }
}

function info(message, extra = {}){
  writeLog("info", { message, extra });
}

function warn(message, extra = {}){
  writeLog("warn", { message, extra });
}

function error(message, extra = {}){
  writeLog("error", { message, extra });
}

function audit(action, extra = {}){
  writeLog("audit", { action, extra });
}

module.exports = {
  info,
  warn,
  error,
  audit
};

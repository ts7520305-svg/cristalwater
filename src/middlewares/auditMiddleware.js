const logger = require("../services/loggerService");

function auditMiddleware(req, res, next){

  const start = Date.now();

  res.on("finish", () => {

    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;

    if (
      method !== "GET" ||
      status >= 400
    ){
      logger.audit("REQUEST", {
        method,
        url,
        status,
        durationMs:Date.now() - start,
        user:req.user || null,
        ip:req.ip,
        body:safeBody(req.body)
      });
    }
  });

  next();
}

function safeBody(body){
  const secrets = new Set(['password','currentpassword','newpassword','confirmpassword','reviewtoken','pin','token']);
  function redact(value, depth = 0) {
    if (value === null || typeof value !== 'object') return value;
    if (depth >= 16) return '[nested data omitted]';
    if (Array.isArray(value)) return value.map(item => redact(item, depth + 1));
    return Object.fromEntries(Object.entries(value).filter(([key]) => !secrets.has(key.toLowerCase())).map(([key, item]) => [key, redact(item, depth + 1)]));
  }
  return body ? redact(body) : null;
}

module.exports = auditMiddleware;

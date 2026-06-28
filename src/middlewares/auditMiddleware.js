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

  if (!body) return null;

  const clone = { ...body };

  delete clone.password;
  delete clone.pin;
  delete clone.token;

  return clone;
}

module.exports = auditMiddleware;
const logger = require("../services/loggerService");

function errorHandlerMiddleware(err, req, res, next){

  logger.error("SERVER_ERROR", {
    message:err.message,
    stack:err.stack,
    url:req.originalUrl,
    method:req.method,
    user:req.user || null
  });

  res.status(500).json({
    ok:false,
    error:"Erro interno do servidor"
  });
}

module.exports = errorHandlerMiddleware;
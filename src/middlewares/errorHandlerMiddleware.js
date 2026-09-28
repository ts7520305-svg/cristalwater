const logger = require("../services/loggerService");
const { MulterError } = require("multer");

function errorHandlerMiddleware(err, req, res, next){

  const incompleteMultipart = /^multipart\/form-data(?:;|$)/i.test(req.headers?.['content-type'] || '')
    && ['Unexpected end of form', 'Unexpected end of file', 'Multipart: Boundary not found', 'Malformed part header'].includes(err.message);
  if (err instanceof MulterError || incompleteMultipart) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .set('Cache-Control', 'private, no-store')
      .json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE'
        ? 'O ficheiro excede o limite permitido para este envio.'
        : 'Envio de ficheiro inválido. Reveja o ficheiro selecionado e tente novamente.' });
  }

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

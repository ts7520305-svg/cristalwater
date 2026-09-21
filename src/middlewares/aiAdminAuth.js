const authenticate = require('./authMiddleware')('ADMIN');

function requireAiAdmin(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  if (String(process.env.AI_ADMIN_ENABLED || 'true').toLowerCase() === 'false') return res.status(503).json({ ok:false, error:'IA administrativa desativada por configuração.' });
  // Keep active-account and password-change checks identical to financial routes.
  return authenticate(req, res, () => {
    const id = req.user.userId || req.user.id;
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(401).json({ ok:false, error:'Conta administrativa não confirmada.' });
    req.aiAdmin = { id, role:'ADMIN', email:req.user.email || null, name:req.user.name || null, mode:'jwt' };
    next();
  });
}
module.exports = { requireAiAdmin };

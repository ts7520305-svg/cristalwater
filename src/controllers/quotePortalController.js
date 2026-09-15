const business = require('../business/repair/QuotePortalBusiness');
const respond = (res, result) => res.status(result.ok ? 200 : result.status || 400).json(result);
exports.list = async (req, res, next) => { try { return respond(res, await business.list(req.params.clientId)); } catch (e) { next(e); } };
exports.publish = async (req, res, next) => { try { return respond(res, await business.publish(req.params.id, req.params.quoteId, `${req.user.principalType || 'USER'}:${req.user.userId || req.user.id}`)); } catch (e) { next(e); } };
exports.decide = async (req, res, next) => { try { return respond(res, await business.decide(req.params.clientId, req.params.quoteId, req.body)); } catch (e) { next(e); } };

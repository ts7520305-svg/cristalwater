const rates = require('../business/finance/ClientRateBusiness');
const respond = fn => async (req,res,next) => { try { res.json(await fn(req)); } catch(error) { if (error.status) return res.status(error.status).json({ok:false,error:error.message}); next(error); } };
module.exports = {
 read: respond(req => rates.read(req.params.clientId)),
 save: respond(req => rates.save(req.params.clientId,req.body || {},req.user.email || `USER:${req.user.id}`)),
 preview: respond(req => ({ok:true,preview:rates.calculate(rates.validate(req.body || {}),req.body.monthRef)})),
};

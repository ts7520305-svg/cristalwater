'use strict';
const service=require('../services/adminOnboardingService');
const respond=fn=>async(req,res)=>{try{const owner=service.owner(req.user);res.set({'X-CW-Onboarding':'admin-onboarding-v1','X-CW-Owner':owner});res.json(await fn(req));}catch(error){const known=typeof error.code==='string'&&error.code.startsWith('ONBOARD_');res.status(known?error.statusCode:503).json({ok:false,version:1,owner:res.get('X-CW-Owner')||null,code:known?error.code:'ONBOARD_UNAVAILABLE',field:known?error.field||null:null});}};
module.exports={options:respond(req=>service.options(req.user,req.query)),review:respond(req=>service.review(req.user,req.body,req.query)),result:respond(req=>service.result(req.user,req.params.requestId,req.query)),create:respond(req=>service.create(req.user,req.body,req.query))};

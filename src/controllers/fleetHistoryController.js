'use strict';
const service=require('../services/fleetHistoryService');
const respond=fn=>async(req,res)=>{res.set('Cache-Control','private, no-store');try{res.set({'X-CW-Fleet-History':'fleet-history-v1','X-CW-Owner':service.owner(req.user)});res.json(await fn(req));}catch(e){const known=typeof e.code==='string'&&e.code.startsWith('FLEET_HISTORY_');res.status(known?e.statusCode:503).json({ok:false,version:1,owner:res.get('X-CW-Owner')||null,code:known?e.code:'FLEET_HISTORY_UNAVAILABLE'});}};
module.exports={list:respond(req=>service.list(req.user,req.query)),detail:respond(req=>service.detail(req.user,req.params.kind,req.params.id,req.query))};

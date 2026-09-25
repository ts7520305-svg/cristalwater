'use strict';
const service=require('../services/supplierHubService');
const respond=fn=>async(req,res)=>{try{res.set({'X-CW-Suppliers':'supplier-hub-v1','X-CW-Owner':service.owner(req.user)});res.json(await fn(req));}catch(error){const known=typeof error.code==='string'&&error.code.startsWith('SUPPLIER_');res.status(known?error.statusCode:503).json({ok:false,version:1,owner:res.get('X-CW-Owner')||null,code:known?error.code:'SUPPLIER_UNAVAILABLE'});}};
module.exports={
 listSuppliers:respond(req=>service.list(req.user,'supplier',req.query)),
 listQuickLinks:respond(req=>service.list(req.user,'link',req.query)),
 createSupplier:respond(req=>service.create(req.user,'supplier',req.body,req.query)),
 createQuickLink:respond(req=>service.create(req.user,'link',req.body,req.query)),
 cancel:respond(req=>service.cancel(req.user,req.params.kind,req.params.requestId,req.body,req.query)),
 result:respond(req=>service.result(req.user,req.params.kind,req.params.requestId,req.query)),
 updateSupplier:respond(req=>service.update(req.user,req.params.id,req.body,req.query)),
 revealSupplierPassword:respond(req=>service.reveal(req.user,req.params.id,req.body,req.query))
};

 'use strict';
const router=require('express').Router(),auth=require('../middlewares/authMiddleware'),multer=require('multer'),c=require('../controllers/transportGuideDocumentController'),service=require('../services/transportGuideDocumentService');
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});router.use(auth());
router.get('/:guideId/files/:versionId',c.file);router.get('/current/:guideId',c.current);
router.use((req,res,next)=>{try{res.set({'X-CW-Transport':'transport-documents-v1','X-CW-Owner':service.owner(req.user)});next();}catch(e){c.error(req,res,e);}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024+1,files:1,fields:1,fieldSize:20000,parts:3},preservePath:true}).single('document');
const parse=(req,res,next)=>upload(req,res,e=>e?c.error(req,res,Object.assign(Error(),{code:'TRANSPORT_INVALID_FILE',statusCode:400})):next());
router.get('/',c.list);router.get('/history/:guideId',c.history);router.post('/review',parse,c.review);router.post('/commit',parse,c.commit);router.get('/result/:requestId',c.result);router.post('/cancel/:requestId',c.cancel);
module.exports=router;

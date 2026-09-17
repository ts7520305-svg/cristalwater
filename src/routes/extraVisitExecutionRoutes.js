'use strict';
const router = require('express').Router();
const multer = require('multer');
const crypto = require('node:crypto');
const execution = require('../services/extraVisitExecutionService');
const photos = require('../services/fieldPhotoRequestService');
router.use(require('../middlewares/authMiddleware')('TECHNICIAN'));
router.use((req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });
const upload = multer({ storage: multer.diskStorage({ destination: (req,file,done) => done(null,require('../config/uploadPath').ensureUploadBaseDirReady()), filename: (req,file,done) => done(null,crypto.randomUUID()+'-extra-photo') }), limits:{fileSize:25*1024*1024,files:1,fields:3} });
function failure(res,error) { return res.status(error.statusCode || 503).json({ok:false,code:error.code || 'EXTRA_VISIT_UNCONFIRMED',error:error.statusCode ? error.message : 'Envio por confirmar. Conserve o pedido original.'}); }
router.post('/:id/start',async(req,res) => { try { res.json(await execution.start(req.user,req.params.id,req.body)); } catch(error) { failure(res,error); } });
router.post('/:id/complete',async(req,res) => { try { res.json(await execution.complete(req.user,req.params.id,req.body)); } catch(error) { failure(res,error); } });
router.post('/:id/photo',(req,res) => upload.single('photo')(req,res,async(error) => {
  try { if(error) throw Object.assign(error,{statusCode:400}); res.json(await photos.record(req.user,req.params.id,req.file,req.body,'EXTRA')); }
  catch(error) { failure(res,error); }
  finally { await photos.cleanTemporary(req.file); }
}));
module.exports = router;

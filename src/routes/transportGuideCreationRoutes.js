'use strict';
const router=require('express').Router(),auth=require('../middlewares/authMiddleware'),c=require('../controllers/transportGuideCreationController');
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});router.use(auth('ADMIN'));
router.get('/',c.list);router.post('/review',c.review);router.post('/commit',c.commit);router.get('/result/:requestId',c.result);router.post('/cancel/:requestId',c.cancel);
module.exports=router;

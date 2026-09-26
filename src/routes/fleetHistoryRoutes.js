'use strict';
const router=require('express').Router(),auth=require('../middlewares/authMiddleware'),c=require('../controllers/fleetHistoryController');
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});router.use(auth('ADMIN'));router.get('/',c.list);router.get('/:kind/:id',c.detail);module.exports=router;

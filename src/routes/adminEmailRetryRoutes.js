"use strict";
const router=require('express').Router(),auth=require('../middlewares/authMiddleware');
router.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');next();});
router.post('/email/retry-failed/:id',auth('ADMIN'),require('../controllers/adminEmailRetryController').retryFailed);
module.exports=router;

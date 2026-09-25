"use strict";
const router=require('express').Router(),auth=require('../middlewares/authMiddleware');
router.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');next();});
router.get('/email-logs',auth('ADMIN'),require('../controllers/adminEmailLogController').listEmailLogs);
module.exports=router;

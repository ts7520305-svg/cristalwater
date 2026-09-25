const express = require("express");
const router = express.Router();
router.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');next();});
router.use(require('../middlewares/authMiddleware')('ADMIN'));
const c = require("../controllers/securityController");
const review = require('../controllers/securityReviewController');
function wrap(fn){ return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }
router.get("/status", wrap(c.securityStatus));
router.get("/audit", wrap(c.auditLogs));
router.get('/console', review.read);
router.get('/users/:id/password-review', review.review);
router.get('/users/:id/password-result/:requestId', review.result);
router.post("/users/:id/change-password", review.reset);
router.post("/users/:id/reset-password", review.reset);
router.put("/users/:id/identity", wrap(c.updateIdentity));
module.exports = router;

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { prepareReports, previewReports, sendReportsNow } = require('../controllers/adminReportController');
router.use(auth('ADMIN'));
router.post('/reports/prepare', prepareReports);
router.get('/reports/email-preview', previewReports);
router.post('/reports/send-now', sendReportsNow);
module.exports = router;

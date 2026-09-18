'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { listClientReports, downloadClientReportPDF, privateResponse } = require('../controllers/clientReportController');

router.use(privateResponse, auth('CLIENT'));
router.get('/:clientId/reports', listClientReports);
router.get('/:clientId/reports/:reportId/pdf', downloadClientReportPDF);
module.exports = router;

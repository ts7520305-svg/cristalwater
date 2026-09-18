'use strict';
// Preserve the historical controller entrypoint with the same ownership rules.
const { downloadClientReportPDF } = require('./clientReportController');
module.exports = { downloadReportPDF: downloadClientReportPDF };

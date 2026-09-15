const express = require('express');
const business = require('../business/technician/LegacyVisitSyncBusiness');
const { invalidateDashboardCache } = require('../services/dashboardCacheService');
const router = express.Router();
router.use(require('../middlewares/authMiddleware')('TECHNICIAN'));

router.post('/text', async (req, res) => {
  const visits = req.body?.visits;
  if (!Array.isArray(visits) || !visits.length || visits.length > 100) return res.status(400).json({ok:false,error:'Envie entre 1 e 100 visitas.'});
  const started = process.hrtime.bigint();
  const results = [];
  for (const payload of visits) {
    try { results.push(await business.sync(req.user, payload)); }
    catch (error) {
      global.metricCounters = global.metricCounters || {};
      global.metricCounters.sync_retry_total = (global.metricCounters.sync_retry_total || 0) + 1;
      results.push({id:payload?.id ?? payload?.visitId ?? payload?.serviceVisitId ?? null,status:'FAILED',error:error.message});
    }
  }
  global.syncLatencyBuffer = global.syncLatencyBuffer || [];
  global.syncLatencyBuffer.push(Number((Number(process.hrtime.bigint()-started)/1000000).toFixed(3)));
  if(global.syncLatencyBuffer.length>1000)global.syncLatencyBuffer.shift();
  global.metricCounters = global.metricCounters || {};
  if(results.some(result=>result.status==='SYNCED')) {
    global.metricCounters.sync_success_total=(global.metricCounters.sync_success_total||0)+1;
    invalidateDashboardCache('V22_SYNC_SUCCESS');
  }
  return res.status(200).json({ok:true,success:true,results});
});
module.exports = router;

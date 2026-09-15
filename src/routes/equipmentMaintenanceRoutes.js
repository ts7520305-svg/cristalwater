const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/equipmentMaintenanceController');
router.get('/pools/:poolId', auth('ADMIN'), controller.listPool);
router.post('/pools/:poolId', auth('ADMIN'), controller.create);
router.put('/plans/:id', auth('ADMIN'), controller.update);
router.get('/visits/:visitId', auth('TECHNICIAN'), controller.listVisit);
router.post('/plans/:id/complete', auth('TECHNICIAN'), controller.complete);
module.exports = router;

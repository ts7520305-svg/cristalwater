const express = require('express');
const router = express.Router();
const controller = require('../controllers/poolCalculationController');

router.post('/preview', controller.previewCalculation);
router.get('/:poolId', controller.getPoolCalculations);
router.post('/:poolId', controller.savePoolCalculations);
router.put('/:poolId', controller.savePoolCalculations);

module.exports = router;

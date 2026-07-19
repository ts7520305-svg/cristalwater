const express = require('express');
const multer = require('multer');
const c = require('../controllers/inventoryController');
const auth = require('../middlewares/authMiddleware');
const { resolveUploadSubdir } = require('../config/uploadPath');

const router = express.Router();
router.use(auth('ADMIN'));
const dest = resolveUploadSubdir('inventory');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dest),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${String(file.originalname || 'documento').replace(/[^a-zA-Z0-9_.-]/g, '_')}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/products', c.listProducts);
router.post('/products', c.createProduct);
router.put('/products/:id', c.updateProduct);
router.delete('/products/:id', c.deleteProduct);
router.post('/products/:id/restore', c.restoreProduct);
router.get('/stock', c.getStock);
router.get('/purchases', c.listPurchases);
router.post('/purchases', upload.single('document'), c.createPurchase);
router.post('/transfer-to-vehicle', c.transferToVehicle);
router.post('/consume', c.consumeMaterial);
router.post('/audit-count', c.auditCount);
router.get('/movements', c.listMovements);
router.get('/report', c.report);

module.exports = router;

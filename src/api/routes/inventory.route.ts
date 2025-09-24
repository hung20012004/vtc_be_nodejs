// src/api/routes/inventory.route.ts
import express from 'express';
import * as InventoryController from '../controllers/inventory.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(protect, authorize('manage-inventory'));

// Routes cho Nhập kho
router.route('/imports')
  .get(InventoryController.getAllImports)
  .post(InventoryController.createImport);
router.get('/imports/:id', InventoryController.getImportById);

// Routes cho Xuất kho
router.route('/exports')
  .get(InventoryController.getAllExports)
  .post(InventoryController.createExport);
router.route('/exports/:id')
  .get(InventoryController.getExportById)
  .patch(InventoryController.cancelExport); // Sử dụng PATCH để cập nhật trạng thái

// Routes cho Tồn kho
router.get('/stock/:productId', InventoryController.getStockForProduct);
router.post('/stock/:stockId/adjust', InventoryController.adjustStock);

export default router;
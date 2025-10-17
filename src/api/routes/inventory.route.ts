import express from 'express';
import * as InventoryController from '../controllers/inventory.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Áp dụng middleware bảo vệ cho tất cả các API kho
router.use(protect, authorize('manage-inventory'));

// --- Routes cho Nhập kho ---
router.route('/imports')
  .get(InventoryController.getAllImports)
  .post(InventoryController.createImport);
router.get('/imports/:id', InventoryController.getImportById);

// --- Routes cho Xuất kho ---
router.route('/exports')
  .get(InventoryController.getAllExports)
  .post(InventoryController.createExport);
router.route('/exports/:id')
  .get(InventoryController.getExportById)
  .patch(InventoryController.cancelExport); // Dùng PATCH để Hủy

// --- Routes cho Tồn kho Chi nhánh ---
router.get('/branches/:branchId', InventoryController.getBranchInventory);

// --- Routes cho Kiểm kho ---
router.post('/checks', InventoryController.startNewCheck);
router.post('/checks/:checkId/items', InventoryController.addItemToCheck);
router.post('/checks/:checkId/complete', InventoryController.completeCheck);

export default router;
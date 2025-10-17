import express from 'express';
import * as InventoryController from '../controllers/inventory.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Áp dụng middleware bảo vệ cho tất cả các API kho
router.use(protect, authorize('manage-inventory'));

// --- Routes cho Nhập kho (Imports) ---
router.get('/imports', authorize('view-inventory'), InventoryController.getAllImports);
router.post('/imports/request', authorize('request-import'), InventoryController.requestImport); // NV Kho
router.get('/imports/:id', authorize('view-inventory'), InventoryController.getImportById);

router.patch('/imports/:id/manage', authorize('approve-import'), InventoryController.manageImportRequest); // Quản lý
router.patch('/imports/:id/payment', authorize('manage-payment'), InventoryController.setImportPaid); // Kế toán
router.post('/imports/:id/receive', authorize('receive-import'), InventoryController.receiveImportShipment); // NV Kho

// --- Routes cho Xuất kho (Exports) ---
router.route('/exports')
  .get(InventoryController.getAllExports)
  .post(InventoryController.createExport);
router.route('/exports/:id')
  .get(InventoryController.getExportById)
  .patch(InventoryController.cancelExport); // Dùng PATCH để Hủy

// --- Routes cho Tồn kho Chi nhánh (Stock) ---
router.get('/branches/:branchId', InventoryController.getBranchInventory);

// --- Routes cho Kiểm kho (Checks) ---
router.route('/checks')
    .get(InventoryController.getAllChecks)
    .post(InventoryController.startNewCheck);

router.route('/checks/:checkId')
    .get(InventoryController.getCheckById)
    .delete(InventoryController.deleteCheck); // Hủy/Xóa phiếu

router.post('/checks/:checkId/items', InventoryController.addItemToCheck);

router.route('/checks/:checkId/items/:itemId')
    .patch(InventoryController.updateItemInCheck) // Sửa số lượng item
    .delete(InventoryController.removeItemFromCheck); // Xóa item khỏi phiếu

router.post('/checks/:checkId/complete', InventoryController.completeCheck);

export default router;
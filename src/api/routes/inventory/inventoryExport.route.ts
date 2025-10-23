import express from 'express';
import * as ExportController from '../../controllers/inventory/inventoryExport.controller'; // Adjust path
import { protect, authorize } from '../../middlewares/auth.middleware'; // Adjust path

const router = express.Router();

// --- Routes chung ---
router.get('/', protect, authorize('view-inventory'), ExportController.getAllExports); // Lấy danh sách (có filter)
router.get('/:id', protect, authorize('view-inventory'), ExportController.getExportById); // Lấy chi tiết

// --- Routes cho Yêu cầu/Chuyển kho (type=3) ---
// Yêu cầu quyền cụ thể cho từng bước
router.post('/request-transfer', protect, authorize('request-transfer'), ExportController.requestTransfer); // Bước 1: NV Chi nhánh yêu cầu
router.patch('/:id/review-branch', protect, authorize('review-branch-transfer'), ExportController.reviewBranchTransfer); // Bước 2: QL Chi nhánh duyệt
router.patch('/:id/review-warehouse', protect, authorize('review-warehouse-transfer'), ExportController.reviewWarehouseTransfer); // Bước 3: QL Kho tổng duyệt
router.post('/:id/ship', protect, authorize('ship-transfer'), ExportController.shipTransfer); // Bước 4: NV Kho tổng gửi
router.post('/:id/receive-shipment', protect, authorize('receive-transfer'), ExportController.receiveTransferShipment); // Bước 5: NV Chi nhánh nhận
router.patch('/:id/cancel-transfer', protect, authorize('cancel-transfer'), ExportController.cancelTransfer); // Hủy yêu cầu/phiếu chuyển

// --- Routes cho Xuất hủy (type=2) ---
router.post('/disposal', protect, authorize('create-disposal'), ExportController.createDisposalExport); // Tạo phiếu hủy

// Không cần route /cancel cho phiếu hủy vì nó hoàn thành ngay. Nếu cần hủy phiếu chờ (ít xảy ra) thì thêm route riêng.

export default router;
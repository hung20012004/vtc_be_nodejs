import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import * as ExportController from '../../controllers/inventory/inventoryExport.controller';

const router = express.Router();
router.use(protect);
router.get('/', authorize('view-inventory'), ExportController.getAllExports);
router.get('/:id', authorize('view-inventory'), ExportController.getExportById);
router.post('/', authorize('manage-inventory'), ExportController.createExport);
router.patch('/:id/cancel', authorize('manage-inventory'), ExportController.cancelExport);
router.post('/:id/receive-transfer', authorize('receive-transfer'), ExportController.receiveTransferShipment);

export default router;
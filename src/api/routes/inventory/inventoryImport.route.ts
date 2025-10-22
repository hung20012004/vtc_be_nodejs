import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import * as ImportController from '../../controllers/inventory/inventoryImport.controller'; 

const router = express.Router();
router.use(protect);
router.get('/', authorize('view-inventory'), ImportController.getAllImports);
router.get('/:id', authorize('view-inventory'), ImportController.getImportById);
router.post('/request', authorize('request-import'), ImportController.requestImport);
router.patch('/:id/review', authorize('approve-import'), ImportController.reviewImportRequest);
router.patch('/:id/payment', authorize('manage-payment'), ImportController.setImportPaid);
router.post('/:id/receive', authorize('receive-import'), ImportController.receiveImportShipment);
router.post('/:id/reject-receipt', authorize('receive-import'), ImportController.rejectImportReceipt);

export default router;
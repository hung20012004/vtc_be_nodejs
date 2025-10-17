import express from 'express';
import * as InventoryController from '../controllers/inventory.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();
router.use(protect, authorize('manage-inventory'));

// API xem tồn kho
router.get('/branches/:branchId', InventoryController.getBranchInventory);

// API quản lý phiếu kiểm kho
router.post('/checks', InventoryController.startNewCheck);
router.post('/checks/:checkId/items', InventoryController.addItemToCheck);
router.post('/checks/:checkId/complete', InventoryController.completeCheck);

export default router;
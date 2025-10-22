import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import * as BranchInventoryController from '../../controllers/inventory/branchInventory.controller'; 

const router = express.Router();
router.use(protect);
router.get('/:branchId/stock', authorize('view-inventory'), BranchInventoryController.getBranchInventory);

export default router;
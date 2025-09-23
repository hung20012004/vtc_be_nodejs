// src/api/routes/inventory.route.ts
import express from 'express';
import * as InventoryController from '../controllers/inventoryImport.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(protect, authorize('manage-inventory'));

router.route('/imports')
  .get(InventoryController.getAllImports)
  .post(InventoryController.createImport);

router.get('/imports/:id', InventoryController.getImportById);

export default router;
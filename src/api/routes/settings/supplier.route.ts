// src/api/routes/supplier.route.ts
import express from 'express';
import * as SupplierController from '../../controllers/settings/supplier.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Bảo vệ tất cả các route, yêu cầu quyền 'manage-inventory'
router.use(protect, authorize('manage-inventory'));

router.route('/')
  .get(SupplierController.getAllSuppliers)
  .post(SupplierController.createSupplier);

router.route('/:id')
  .get(SupplierController.getSupplierById)
  .patch(SupplierController.updateSupplier)
  .delete(SupplierController.deleteSupplier);

export default router;
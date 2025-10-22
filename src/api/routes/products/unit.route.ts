// src/api/routes/unit.route.ts

import express from 'express';
import * as UnitController from '../../controllers/products/unit.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Bảo vệ tất cả các route, yêu cầu đăng nhập và có quyền 'manage-products'
router.use(protect, authorize('manage-products'));

router.route('/')
  .get(UnitController.getAllUnits)
  .post(UnitController.createUnit);

router.route('/:id')
  .get(UnitController.getUnitById)
  .patch(UnitController.updateUnit)
  .delete(UnitController.deleteUnit);

export default router;
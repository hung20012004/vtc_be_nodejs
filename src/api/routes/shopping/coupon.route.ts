// src/api/routes/coupon.route.ts
import express from 'express';
import * as CouponController from '../../controllers/shopping/coupon.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Bảo vệ tất cả các route, yêu cầu quyền 'manage-promotions' (bạn có thể tạo quyền này)
router.use(protect, authorize('manage-products')); // Tạm dùng quyền manage-products

router.route('/')
  .get(CouponController.getAllCoupons)
  .post(CouponController.createCoupon);

router.route('/:id')
  .get(CouponController.getCouponById)
  .patch(CouponController.updateCoupon)
  .delete(CouponController.deleteCoupon);

export default router;
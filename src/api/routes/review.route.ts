// src/api/routes/review.route.ts
import express from 'express';
import * as ReviewController from '../controllers/review.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Public route để xem reviews của một sản phẩm
router.get('/products/:productId/reviews', ReviewController.getProductReviews);

// Customer route để gửi review (yêu cầu đăng nhập)
router.post('/products/:productId/reviews', protect, ReviewController.submitReview);

// Admin routes để quản lý reviews
const adminRouter = express.Router();
adminRouter.use(protect, authorize('manage-blog')); // Tạm dùng quyền cũ
adminRouter.patch('/:id/moderate', ReviewController.moderateReview);

router.use('/reviews/manage', adminRouter);

export default router;
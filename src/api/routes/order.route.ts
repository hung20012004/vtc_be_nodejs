import express from 'express';
import * as OrderController from '../controllers/order.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Đặt tên route rõ ràng hơn
router.post('/place-order', protect, OrderController.placeOrder);

// (Bạn có thể thêm các route quản lý và xem lịch sử đơn hàng ở đây)

export default router;
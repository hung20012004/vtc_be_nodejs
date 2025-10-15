import express from 'express';
import * as ShippingController from '../controllers/shipping.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Định nghĩa endpoint POST /options
// Middleware 'protect' đảm bảo chỉ người dùng đã đăng nhập mới có thể gọi API này.
router.post('/options', protect, ShippingController.getShippingOptions);

// (Bạn có thể thêm các route khác liên quan đến vận chuyển ở đây, ví dụ: tạo đơn hàng)

export default router;
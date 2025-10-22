import express from 'express';
import * as OrderController from '../../controllers/orders/order.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// --- Routes cho Khách hàng ---
router.post('/', protect, OrderController.placeOrder); // Đặt hàng
router.get('/my-orders', protect, OrderController.getMyOrders); // Xem ds đơn hàng của tôi
router.get('/my-orders/:id', protect, OrderController.getMyOrderDetails); // Xem chi tiết đơn hàng của tôi

// --- Routes cho Quản trị viên ---
// Prefix /manage được thêm vào khi sử dụng router này trong app.ts
const adminRouter = express.Router();
adminRouter.use(protect, authorize('manage-orders')); // Yêu cầu đăng nhập và quyền quản lý đơn hàng

adminRouter.get('/', OrderController.getAllOrders); // Xem tất cả đơn hàng
adminRouter.get('/:id', OrderController.getOrderDetails); // Xem chi tiết đơn hàng bất kỳ
adminRouter.patch('/:id/status', OrderController.updateOrderStatus); // Cập nhật trạng thái đơn hàng

// Gắn adminRouter vào đường dẫn /manage
router.use('/manage', adminRouter);

export default router;
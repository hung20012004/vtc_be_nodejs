import express from 'express';
import * as OrderController from '../controllers/order.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// --- Routes cho Khách hàng ---
router.post('/', protect, OrderController.placeOrder);
// router.get('/my-orders', protect, OrderController.getMyOrders);
// router.get('/my-orders/:id', protect, OrderController.getMyOrderById);

// --- Routes cho Quản trị viên ---
const adminRouter = express.Router();
adminRouter.use(protect, authorize('manage-orders'));

adminRouter.get('/', OrderController.getAllOrders);
adminRouter.get('/:id', OrderController.getOrderDetails);
adminRouter.patch('/:id/status', OrderController.updateOrderStatus);

router.use('/manage', adminRouter);

export default router;
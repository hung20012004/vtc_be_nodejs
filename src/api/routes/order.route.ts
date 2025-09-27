// src/api/routes/order.routes.ts

import express from 'express';
import * as OrderController from '../controllers/order.controller';
import * as OrderItemController from '../controllers/orderItem.controller';
import * as OrderStatusHistoryController from '../controllers/orderStatusHistory.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// ======================= COMMON ROUTES (USER + ADMIN) ======================= //
router.use(protect);

// --- Orders ---
router.post('/', OrderController.createOrder); // Cả user & admin đều có thể tạo đơn

// --- Customer specific (chỉ lấy đơn của chính họ) ---
router.get('/my-orders', OrderController.getMyOrders);
router.get('/my-orders/:id', OrderController.getMyOrderById);

// --- Order Items ---
router.get('/my-orders/:orderId/items', OrderItemController.getMyOrderItems);

// --- Order Status Histories ---
router.get('/my-orders/:orderId/status-histories', OrderStatusHistoryController.getMyOrderStatusHistories);



// ======================= ADMIN ROUTES ======================= //
router.use(authorize('manage-products'));

// --- Orders ---
router.get('/', OrderController.getAllOrders);

// --- Order Status Histories ---
router.route('/status-histories')
  .get(OrderStatusHistoryController.getAllOrderStatusHistories);
router.get('/:orderId/status-histories', OrderStatusHistoryController.getOrderStatusHistoriesByOrderId);
router.patch('/:orderId/status', OrderController.updateOrderStatus);

router.route('/:id')
  .get(OrderController.getOrderById)
  .delete(OrderController.deleteOrder); // k cần thiết


// --- Order Items ---
router.route('/items/:id')
  .get(OrderItemController.getOrderItemById)

router.get('/:orderId/items', OrderItemController.getOrderItemsByOrderId);


export default router;

// src/api/routes/product.route.ts
import express from 'express';
import * as ProductController from '../controllers/product.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Route lấy danh sách sản phẩm và chi tiết sản phẩm là công khai
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

// Các route thay đổi dữ liệu cần quyền 'manage-products'
router.post('/', protect, authorize('manage-products'), ProductController.createProduct);
router.patch('/:id', protect, authorize('manage-products'), ProductController.updateProduct);
router.delete('/:id', protect, authorize('manage-products'), ProductController.deleteProduct);

export default router;
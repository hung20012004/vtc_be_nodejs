// src/api/routes/category.route.ts
import express from 'express';
import * as CategoryController from '../controllers/category.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Route lấy danh sách danh mục có thể công khai, không cần bảo vệ
router.get('/', CategoryController.getAllCategories);
router.get('/:id', CategoryController.getCategoryById);

// Các route thay đổi dữ liệu (tạo, sửa, xóa) cần quyền admin
router.post('/', protect, authorize('manage-products'), CategoryController.createCategory);
router.patch('/:id', protect, authorize('manage-products'), CategoryController.updateCategory);
router.delete('/:id', protect, authorize('manage-products'), CategoryController.deleteCategory);

export default router;
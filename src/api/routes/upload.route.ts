import express from 'express';
import { getCloudinarySignature } from '../controllers/upload.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

/**
 * Route để lấy chữ ký.
 * Yêu cầu người dùng phải đăng nhập và có quyền 'manage-products'
 * để ngăn chặn người lạ lạm dụng API tạo chữ ký.
 */
router.post('/signature', protect, authorize('manage-products'), getCloudinarySignature);

export default router;
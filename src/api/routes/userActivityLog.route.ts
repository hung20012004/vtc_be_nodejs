// src/api/routes/userActivityLog.route.ts

import express from 'express';
import { getAllLogsController } from '../controllers/userActivityLog.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Bảo vệ route, yêu cầu đăng nhập và có quyền 'manage-users' (hoặc bạn có thể tạo quyền 'view-logs')
router.get('/', protect, authorize('manage-users'), getAllLogsController);

export default router;
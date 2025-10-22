// src/api/routes/notification.route.ts
import express from 'express';
import * as NotificationController from '../../controllers/shopping/notification.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route thông báo đều yêu cầu người dùng phải đăng nhập
router.use(protect);

router.get('/', NotificationController.getMyNotifications);
router.patch('/read-all', NotificationController.markAllNotificationsAsRead);
router.patch('/:id/read', NotificationController.markNotificationAsRead);

export default router;
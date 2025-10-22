// src/api/routes/setting.route.ts
import express from 'express';
import * as SettingController from '../../controllers/settings/setting.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Route công khai để frontend lấy các cài đặt cần thiết
router.get('/', SettingController.getPublicSettings);

// Các route quản lý dành cho admin
const adminRouter = express.Router();
adminRouter.use(protect, authorize('admin')); // Chỉ admin mới có quyền cao nhất này
adminRouter.get('/', SettingController.getAllSettings);
adminRouter.patch('/', SettingController.updateSettings);

router.use('/manage', adminRouter);

export default router;
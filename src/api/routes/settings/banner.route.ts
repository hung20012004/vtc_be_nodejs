// src/api/routes/banner.route.ts
import express from 'express';
import * as BannerController from '../../controllers/settings/banner.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Route công khai để lấy banner hiển thị cho người dùng
router.get('/', BannerController.getPublicBanners);

// Các route quản lý (CRUD) dành cho admin
const adminRouter = express.Router();
adminRouter.use(protect, authorize('manage-products')); // Tạm dùng quyền manage-products
adminRouter.get('/', BannerController.getAllBanners);
adminRouter.post('/', BannerController.createBanner);
adminRouter.patch('/:id', BannerController.updateBanner);
adminRouter.delete('/:id', BannerController.deleteBanner);

// Gắn router admin vào một đường dẫn riêng
router.use('/manage', adminRouter);

export default router;
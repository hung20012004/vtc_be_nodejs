// src/api/routes/faq.route.ts
import express from 'express';
import * as FaqController from '../controllers/faq.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Route công khai để người dùng xem FAQ
router.get('/', FaqController.getPublicFaqs);

// Các route quản lý dành cho admin
const adminRouter = express.Router();
adminRouter.use(protect, authorize('manage-blog')); // Tạm dùng quyền manage-blog hoặc tạo quyền mới
adminRouter.get('/', FaqController.getAllFaqs);
adminRouter.post('/', FaqController.createFaq);
adminRouter.patch('/:id', FaqController.updateFaq);
adminRouter.delete('/:id', FaqController.deleteFaq);

router.use('/manage', adminRouter);

export default router;
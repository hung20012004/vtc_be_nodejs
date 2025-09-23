// src/api/routes/contact.route.ts
import express from 'express';
import * as ContactController from '../controllers/contact.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Route công khai để người dùng gửi liên hệ
router.post('/', ContactController.submitContactForm);

// Các route quản lý dành cho admin
const adminRouter = express.Router();
adminRouter.use(protect, authorize('manage-products')); // Tạm dùng quyền manage-products
adminRouter.get('/', ContactController.getAllContacts);
adminRouter.get('/:id', ContactController.getContactById);
adminRouter.post('/:id/respond', ContactController.respondToContact);
adminRouter.delete('/:id', ContactController.deleteContact);

router.use('/manage', adminRouter);

export default router;
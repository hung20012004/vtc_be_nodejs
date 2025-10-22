import express from 'express';
import * as PostCategoryController from '../../controllers/posts/postCategory.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các API trong file này đều yêu cầu đăng nhập và có quyền 'manage-blog'
router.use(protect, authorize('manage-blog'));

router.route('/')
    .get(PostCategoryController.getAllCategories)
    .post(PostCategoryController.createCategory);

router.route('/:id')
    .get(PostCategoryController.getCategoryById)
    .patch(PostCategoryController.updateCategory)
    .delete(PostCategoryController.deleteCategory);

export default router;
import express from 'express';
import * as PostController from '../../controllers/posts/post.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// ===========================================
// == PUBLIC ROUTES
// ===========================================

// GET /api/v1/posts (Lấy danh sách bài viết đã xuất bản - có phân trang)
router.get('/', PostController.getAllPosts);

// GET /api/v1/posts/ten-bai-viet (Lấy chi tiết bài viết đã xuất bản bằng slug)
router.get('/:slug', PostController.getPostBySlug);


// ===========================================
// == ADMIN ROUTES (Cần xác thực & quyền)
// ===========================================

// POST /api/v1/posts (Tạo bài viết mới)
router.post('/', protect, authorize('manage-blog'), PostController.createPost);

// GET /api/v1/posts/details/:id (Lấy chi tiết bất kỳ bài viết nào bằng ID cho Admin)
router.get('/details/:id', protect, authorize('manage-blog'), PostController.getPostById);

// PATCH /api/v1/posts/:id (Cập nhật bài viết bằng ID)
router.patch('/:id', protect, authorize('manage-blog'), PostController.updatePost);

// DELETE /api/v1/posts/:id (Xóa bài viết bằng ID)
router.delete('/:id', protect, authorize('manage-blog'), PostController.deletePost);

export default router;

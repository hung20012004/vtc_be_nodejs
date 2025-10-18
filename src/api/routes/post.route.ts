import express from 'express';
import * as PostController from '../controllers/post.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Public routes
router.get('/', PostController.getAllPosts);
router.get('/:slug', PostController.getPostBySlug);

// Admin routes
router.post('/', protect, authorize('manage-blog'), PostController.createPost);
router.patch('/:id', protect, authorize('manage-blog'), PostController.updatePost);
router.delete('/:id', protect, authorize('manage-blog'), PostController.deletePost);

export default router;
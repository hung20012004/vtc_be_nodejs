// src/api/routes/post.route.ts
import express from 'express';
import * as PostController from '../controllers/post.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// == PUBLIC ROUTES ==
router.get('/', PostController.getPublishedPosts);
router.get('/:slug', PostController.getPostBySlug);

// == ADMIN ROUTES ==
const adminRouter = express.Router();
// Bạn nên tạo một permission mới là 'manage-blog' và gán cho admin
adminRouter.use(protect, authorize('manage-blog')); 
adminRouter.get('/', PostController.getAllPosts);
adminRouter.post('/', PostController.createPost);
adminRouter.get('/:id', PostController.getPostById);
adminRouter.patch('/:id', PostController.updatePost);
adminRouter.delete('/:id', PostController.deletePost);

router.use('/manage', adminRouter);

export default router;
import express from 'express';
import * as TagController from '../controllers/tag.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(protect, authorize('manage-blog'));

router.route('/')
    .get(TagController.getAllTags)
    .post(TagController.createTag);

router.route('/:id')
    .get(TagController.getTagById)
    .patch(TagController.updateTag)
    .delete(TagController.deleteTag);

export default router;
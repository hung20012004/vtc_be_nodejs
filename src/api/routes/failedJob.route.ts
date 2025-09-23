// src/api/routes/failedJob.route.ts
import express from 'express';
import * as FailedJobController from '../controllers/failedJob.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route này đều là công cụ quản trị, yêu cầu quyền admin
router.use(protect, authorize('admin'));

router.route('/')
  .get(FailedJobController.getAllFailedJobs)
  .delete(FailedJobController.deleteAllFailedJobs);

router.delete('/:id', FailedJobController.deleteFailedJob);

export default router;
import express from 'express';
import * as BranchController from '../controllers/branch.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả API quản lý chi nhánh đều yêu cầu quyền admin
router.use(protect, authorize('manage-settings'));

router.route('/')
    .get(BranchController.getAllBranches)
    .post(BranchController.createBranch);

router.route('/:id')
    .get(BranchController.getBranchById)
    .patch(BranchController.updateBranch)
    .delete(BranchController.deleteBranch);

export default router;
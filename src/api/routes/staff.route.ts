import express from 'express';
import * as StaffController from '../controllers/staff.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các API quản lý nhân viên đều yêu cầu quyền 'manage-users'
router.use(protect, authorize('manage-users'));

router.route('/')
    .get(StaffController.getAllStaff)
    .post(StaffController.createStaff);

router.route('/:id')
    .get(StaffController.getStaffById)
    .patch(StaffController.updateStaff)
    .delete(StaffController.deleteStaff);

export default router;
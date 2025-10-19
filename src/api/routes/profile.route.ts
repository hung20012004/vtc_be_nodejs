import express from 'express';
import * as ProfileController from '../controllers/profile.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các API trong file này đều yêu cầu người dùng phải đăng nhập.
// Middleware `protect` sẽ được áp dụng cho tất cả các route bên dưới.
router.use(protect);

// Route để LẤY (GET) và CẬP NHẬT (PATCH) thông tin profile cơ bản
router.route('/me')
    .get(ProfileController.getMyProfile)
    .patch(ProfileController.updateMyProfile);

// Route riêng để ĐỔI MẬT KHẨU
router.patch('/me/change-password', ProfileController.changeMyPassword);

export default router;
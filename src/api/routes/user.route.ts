// src/api/routes/user.route.ts
import express from 'express';
import * as UserController from '../controllers/user.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route này đều yêu cầu quyền 'manage-users'
router.use(protect, authorize('manage-users'));

router.route('/')
    .post(UserController.createEmployee)
    .get(UserController.getAllUsers);

router.route('/:id')
    .patch(UserController.updateUser)
    .delete(UserController.deleteUser);

export default router;
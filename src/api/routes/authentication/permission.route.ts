// src/api/routes/permission.route.ts

import express from 'express';
import * as PermissionController from '../../controllers/authentication/permission.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(protect, authorize('manage-permissions'));

// Định nghĩa các route cho CRUD
router.route('/')
  .get(PermissionController.getAllPermissions)
  .post(PermissionController.createPermission);

router.route('/:id')
  .get(PermissionController.getPermissionById)
  .patch(PermissionController.updatePermission)
  .delete(PermissionController.deletePermission);

export default router;
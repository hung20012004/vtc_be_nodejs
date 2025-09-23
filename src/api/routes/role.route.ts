
import express from 'express';
import * as RoleController from '../controllers/role.controller';
import * as PermissionRoleController from '../controllers/permissionRole.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route bên dưới đều được bảo vệ và yêu cầu quyền admin
router.use(protect, authorize('manage-roles'));

// Các route CRUD cho role
router.route('/')
  .get(RoleController.getAllRoles)
  .post(RoleController.createRole);

router.route('/:id')
  .get(RoleController.getRoleById)
  .patch(RoleController.updateRole)
  .delete(RoleController.deleteRole);

// --- CÁC ROUTE MỚI ĐỂ QUẢN LÝ PERMISSION CỦA ROLE ---

router.route('/:roleId/permissions')
    .get(PermissionRoleController.getPermissionsForRole)
    .post(PermissionRoleController.assignPermission);

router.delete('/:roleId/permissions/:permissionId', PermissionRoleController.revokePermission);


export default router;
import express from 'express';
import * as RoleController from '../controllers/role.controller';
import * as PermissionRoleController from '../controllers/permissionRole.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// --- Các route GET (không bảo vệ) ---
router.get('/', RoleController.getAllRoles);
router.get('/:id', RoleController.getRoleById);
router.get('/:roleId/permissions', PermissionRoleController.getPermissionsForRole);

// --- Các route cần bảo vệ ---
router.use(protect, authorize('manage-roles'));

// CRUD cho role (trừ GET)
router.post('/', RoleController.createRole);
router.patch('/:id', RoleController.updateRole);
router.delete('/:id', RoleController.deleteRole);

// Quản lý permission của role (trừ GET)
router.post('/:roleId/permissions', PermissionRoleController.assignPermission);
router.delete('/:roleId/permissions/:permissionId', PermissionRoleController.revokePermission);

export default router;
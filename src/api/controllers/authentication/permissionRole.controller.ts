// src/api/controllers/permissionRole.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as PermissionRoleModel from '../../models/authentication/permission_role.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model'; // 1. Import hàm ghi log
import { findRoleById } from '../../models/authentication/role.model'; // Import model để lấy tên role
import { findPermissionById } from '../../models/authentication/permission.model'; // Import model để lấy tên permission
import { User } from '../../types/authentication/user.type'; // Import User type

// Gán quyền cho vai trò
export const assignPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = parseInt(req.params.roleId, 10);
    const { permissionId } = req.body;
    const user = req.user as User;

    if (!permissionId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp permissionId.' });
    }

    await PermissionRoleModel.assignPermissionToRole(roleId, permissionId);

    // --- GHI LOG ---
    // Lấy thông tin chi tiết để ghi log
    const role = await findRoleById(roleId);
    const permission = await findPermissionById(permissionId);

    if (role && permission) {
        await createActivityLog({
            user_id: user.id,
            action: 'assign-permission',
            details: `User assigned permission '${permission.name}' to role '${role.name}'`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });
    }
    // ---------------

    res.status(200).json({ message: 'Gán quyền thành công.' });
  } catch (error) {
    next(error);
  }
};

// Thu hồi quyền khỏi vai trò
export const revokePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = parseInt(req.params.roleId, 10);
    const permissionId = parseInt(req.params.permissionId, 10);
    const user = req.user as User;

    // Lấy thông tin trước khi xóa để ghi log
    const role = await findRoleById(roleId);
    const permission = await findPermissionById(permissionId);

    const success = await PermissionRoleModel.revokePermissionFromRole(roleId, permissionId);

    if (!success) {
        // Có thể quyền này chưa từng được gán, không cần báo lỗi
        return res.status(200).json({ message: 'Không có quyền nào được thu hồi (có thể do chưa được gán).'});
    }

    // --- GHI LOG ---
    if (role && permission) {
        await createActivityLog({
            user_id: user.id,
            action: 'revoke-permission',
            details: `User revoked permission '${permission.name}' from role '${role.name}'`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });
    }
    // ---------------

    res.status(200).json({ message: 'Thu hồi quyền thành công.' });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả quyền của một vai trò (Thao tác đọc, không cần ghi log)
export const getPermissionsForRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = parseInt(req.params.roleId, 10);
    const permissions = await PermissionRoleModel.getPermissionsByRoleId(roleId);
    res.status(200).json(permissions);
  } catch (error) {
    next(error);
  }
};
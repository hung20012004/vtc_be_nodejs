// src/api/controllers/permissionRole.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as PermissionRoleModel from '../models/permission_role.model';

// Gán quyền cho vai trò
export const assignPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = parseInt(req.params.roleId, 10);
    const { permissionId } = req.body;

    if (!permissionId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp permissionId.' });
    }

    await PermissionRoleModel.assignPermissionToRole(roleId, permissionId);
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

    await PermissionRoleModel.revokePermissionFromRole(roleId, permissionId);
    res.status(200).json({ message: 'Thu hồi quyền thành công.' });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả quyền của một vai trò
export const getPermissionsForRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = parseInt(req.params.roleId, 10);
    const permissions = await PermissionRoleModel.getPermissionsByRoleId(roleId);
    res.status(200).json(permissions);
  } catch (error) {
    next(error);
  }
};
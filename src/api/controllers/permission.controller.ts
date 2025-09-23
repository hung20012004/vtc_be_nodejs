// src/api/controllers/permission.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as PermissionModel from '../models/permission.model';
import { createActivityLog } from '../models/user_activity_logs.model'; // 1. Import hàm ghi log
import { User } from '../types/user.type'; // Import User type để TypeScript hiểu req.user

// Lấy tất cả quyền (Thao tác đọc, không cần ghi log)
export const getAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await PermissionModel.getAllPermissions();
    res.status(200).json(permissions);
  } catch (error) {
    next(error);
  }
};

// Lấy một quyền theo ID (Thao tác đọc, không cần ghi log)
export const getPermissionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const permission = await PermissionModel.findPermissionById(id);
    if (!permission) {
      return res.status(404).json({ message: 'Không tìm thấy quyền hạn.' });
    }
    res.status(200).json(permission);
  } catch (error) {
    next(error);
  }
};

// Tạo quyền mới (Hành động CẦN ghi log)
export const createPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newPermission = await PermissionModel.createPermission(req.body);
    const user = req.user as User; // Lấy thông tin người dùng đang thực hiện hành động

    // --- GHI LOG ---
    await createActivityLog({
        user_id: user.id,
        action: 'create-permission',
        details: `User created permission '${newPermission.name}' (ID: ${newPermission.id})`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
    });
    // ---------------

    res.status(201).json(newPermission);
  } catch (error) {
    next(error);
  }
};

// Cập nhật quyền (Hành động CẦN ghi log)
export const updatePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedPermission = await PermissionModel.updatePermission(id, req.body);

    if (!updatedPermission) {
      return res.status(404).json({ message: 'Không tìm thấy quyền hạn để cập nhật.' });
    }

    const user = req.user as User;

    // --- GHI LOG ---
    await createActivityLog({
        user_id: user.id,
        action: 'update-permission',
        details: `User updated permission ID: ${id}`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
    });
    // ---------------

    res.status(200).json(updatedPermission);
  } catch (error) {
    next(error);
  }
};

// Xóa quyền (Hành động CẦN ghi log)
export const deletePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Lấy thông tin permission trước khi xóa để ghi log cho đầy đủ
    const permissionToDelete = await PermissionModel.findPermissionById(id);
    if (!permissionToDelete) {
        return res.status(404).json({ message: 'Không tìm thấy quyền hạn để xóa.' });
    }

    await PermissionModel.deletePermission(id);
    const user = req.user as User;

    // --- GHI LOG ---
    await createActivityLog({
        user_id: user.id,
        action: 'delete-permission',
        details: `User deleted permission '${permissionToDelete.name}' (ID: ${id})`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
    });
    // ---------------

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
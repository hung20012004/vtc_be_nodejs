// src/api/controllers/role.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as RoleModel from '../models/role.model';
import { createActivityLog } from '../models/user_activity_logs.model'; // 1. Import hàm ghi log
import { User } from '../types/user.type'; // Import User type

// Lấy tất cả vai trò (Thao tác đọc, không cần log)
export const getAllRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await RoleModel.getAllRoles();
    res.status(200).json(roles);
  } catch (error) {
    next(error);
  }
};

// Lấy một vai trò theo ID (Thao tác đọc, không cần log)
export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const role = await RoleModel.findRoleById(id);
    if (!role) {
      return res.status(404).json({ message: 'Không tìm thấy vai trò.' });
    }
    res.status(200).json(role);
  } catch (error) {
    next(error);
  }
};

// Tạo vai trò mới (Hành động CẦN ghi log)
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newRole = await RoleModel.createRole(req.body);
    const user = req.user as User;

    // --- GHI LOG ---
    await createActivityLog({
        user_id: user.id,
        action: 'create-role',
        details: `User created role '${newRole.name}' (ID: ${newRole.id})`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
    });
    // ---------------

    res.status(201).json(newRole);
  } catch (error) {
    next(error);
  }
};

// Cập nhật vai trò (Hành động CẦN ghi log)
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedRole = await RoleModel.updateRole(id, req.body);
    if (!updatedRole) {
      return res.status(404).json({ message: 'Không tìm thấy vai trò để cập nhật.' });
    }
    
    const user = req.user as User;

    // --- GHI LOG ---
    await createActivityLog({
        user_id: user.id,
        action: 'update-role',
        details: `User updated role ID: ${id}`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
    });
    // ---------------

    res.status(200).json(updatedRole);
  } catch (error) {
    next(error);
  }
};

// Xóa vai trò (Hành động CẦN ghi log)
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Lấy thông tin role trước khi xóa để ghi log chi tiết
    const roleToDelete = await RoleModel.findRoleById(id);
    if (!roleToDelete) {
        return res.status(404).json({ message: 'Không tìm thấy vai trò để xóa.' });
    }
    
    await RoleModel.deleteRole(id);
    const user = req.user as User;

    // --- GHI LOG ---
    await createActivityLog({
        user_id: user.id,
        action: 'delete-role',
        details: `User deleted role '${roleToDelete.name}' (ID: ${id})`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
    });
    // ---------------

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
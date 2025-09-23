
import { Request, Response, NextFunction } from 'express';
import * as RoleModel from '../models/role.model'; 

// Lấy tất cả vai trò
export const getAllRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await RoleModel.getAllRoles();
    res.status(200).json(roles);
  } catch (error) {
    next(error);
  }
};

// Lấy một vai trò theo ID
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

// Tạo vai trò mới
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newRole = await RoleModel.createRole(req.body);
    res.status(201).json(newRole);
  } catch (error) {
    next(error);
  }
};

// Cập nhật vai trò
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedRole = await RoleModel.updateRole(id, req.body);
    if (!updatedRole) {
      return res.status(404).json({ message: 'Không tìm thấy vai trò để cập nhật.' });
    }
    res.status(200).json(updatedRole);
  } catch (error) {
    next(error);
  }
};

// Xóa vai trò
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const success = await RoleModel.deleteRole(id);
    if (!success) {
      return res.status(404).json({ message: 'Không tìm thấy vai trò để xóa.' });
    }
    res.status(204).send(); // 204 No Content
  } catch (error) {
    next(error);
  }
};
// src/api/controllers/permission.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as PermissionModel from '../models/permission.model';

// Lấy tất cả quyền
export const getAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await PermissionModel.getAllPermissions();
    res.status(200).json(permissions);
  } catch (error) {
    next(error);
  }
};

// Lấy một quyền theo ID
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

// Tạo quyền mới
export const createPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newPermission = await PermissionModel.createPermission(req.body);
    res.status(201).json(newPermission);
  } catch (error) {
    next(error);
  }
};

// Cập nhật quyền
export const updatePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedPermission = await PermissionModel.updatePermission(id, req.body);
    if (!updatedPermission) {
      return res.status(404).json({ message: 'Không tìm thấy quyền hạn để cập nhật.' });
    }
    res.status(200).json(updatedPermission);
  } catch (error) {
    next(error);
  }
};

// Xóa quyền
export const deletePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const success = await PermissionModel.deletePermission(id);
    if (!success) {
      return res.status(404).json({ message: 'Không tìm thấy quyền hạn để xóa.' });
    }
    res.status(204).send(); // 204 No Content
  } catch (error) {
    next(error);
  }
};
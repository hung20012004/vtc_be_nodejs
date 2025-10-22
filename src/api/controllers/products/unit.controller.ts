// src/api/controllers/unit.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as UnitModel from '../../models/products/unit.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

// Lấy tất cả đơn vị tính
export const getAllUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const units = await UnitModel.getAllUnits();
    res.status(200).json(units);
  } catch (error) {
    next(error);
  }
};

// Lấy đơn vị tính theo ID
export const getUnitById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const unit = await UnitModel.findUnitById(id);
    if (!unit) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị tính.' });
    }
    res.status(200).json(unit);
  } catch (error) {
    next(error);
  }
};

// Tạo đơn vị tính mới
export const createUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newUnit = await UnitModel.createUnit(req.body);
    const user = req.user as User;
    await createActivityLog({
        user_id: user.id,
        action: 'create-unit',
        details: `User created unit '${newUnit.name}' (ID: ${newUnit.id})`,
        ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
    });
    res.status(201).json(newUnit);
  } catch (error) {
    next(error);
  }
};

// Cập nhật đơn vị tính
export const updateUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedUnit = await UnitModel.updateUnit(id, req.body);
    if (!updatedUnit) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị tính để cập nhật.' });
    }
    const user = req.user as User;
    await createActivityLog({
        user_id: user.id, action: 'update-unit',
        details: `User updated unit ID: ${id}`,
        ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
    });
    res.status(200).json(updatedUnit);
  } catch (error) {
    next(error);
  }
};

// Xóa đơn vị tính
export const deleteUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const unitToDelete = await UnitModel.findUnitById(id);
    if (!unitToDelete) {
        return res.status(404).json({ message: 'Không tìm thấy đơn vị tính để xóa.' });
    }
    await UnitModel.deleteUnit(id);
    const user = req.user as User;
    await createActivityLog({
        user_id: user.id, action: 'delete-unit',
        details: `User deleted unit '${unitToDelete.name}' (ID: ${id})`,
        ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
// src/api/controllers/supplier.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as SupplierModel from '../../models/settings/supplier.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

export const getAllSuppliers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const suppliers = await SupplierModel.getAllSuppliers();
        res.status(200).json(suppliers);
    } catch (error) { next(error); }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const supplier = await SupplierModel.findSupplierById(id);
        if (!supplier) {
            return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp.' });
        }
        res.status(200).json(supplier);
    } catch (error) { next(error); }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newSupplier = await SupplierModel.createSupplier(req.body);
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'create-supplier',
            details: `User created supplier '${newSupplier.name}' (ID: ${newSupplier.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newSupplier);
    } catch (error) { next(error); }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedSupplier = await SupplierModel.updateSupplier(id, req.body);
        if (!updatedSupplier) {
            return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp để cập nhật.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-supplier',
            details: `User updated supplier ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedSupplier);
    } catch (error) { next(error); }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await SupplierModel.deleteSupplier(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp để xóa.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-supplier',
            details: `User deleted supplier ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
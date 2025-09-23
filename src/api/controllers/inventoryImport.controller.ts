// src/api/controllers/inventory.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as InventoryModel from '../models/inventory_imports.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const getAllImports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const imports = await InventoryModel.findAllImports(limit, offset);
        res.status(200).json(imports);
    } catch (error) { next(error); }
};

export const getImportById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const importData = await InventoryModel.findImportById(id);
        if (!importData) {
            return res.status(404).json({ message: 'Không tìm thấy phiếu nhập kho.' });
        }
        res.status(200).json(importData);
    } catch (error) { next(error); }
};

export const createImport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...importData } = req.body;
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết phiếu nhập (details) là bắt buộc.' });
        }
        
        const user = req.user as User;
        const newImport = await InventoryModel.createImport(importData, details, user.id);
        
        await createActivityLog({
            user_id: user.id, action: 'create-inventory-import',
            details: `User created inventory import '${newImport.import_code}' (ID: ${newImport.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(201).json(newImport);
    } catch (error) { next(error); }
};
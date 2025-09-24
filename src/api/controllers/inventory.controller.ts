// src/api/controllers/inventory.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as InventoryModel from '../models/inventory.model';
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



export const getStockForProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        const stocks = await InventoryModel.findStockByProductId(productId);
        res.status(200).json(stocks);
    } catch (error) { next(error); }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stockId = parseInt(req.params.stockId, 10);
        const { newQuantity, reason } = req.body;
        const user = req.user as User;
        if (newQuantity === undefined || !reason) {
            return res.status(400).json({ message: 'Vui lòng cung cấp newQuantity và reason.' });
        }
        await InventoryModel.adjustStock(stockId, newQuantity, reason, user.id);
        res.status(200).json({ message: 'Điều chỉnh kho thành công.' });
    } catch (error) { next(error); }
};


////////
export const createExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...exportData } = req.body;
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết phiếu xuất (details) là bắt buộc.' });
        }
        
        const user = req.user as User;
        const newExport = await InventoryModel.createExport(exportData, details, user.id);
        
        await createActivityLog({
            user_id: user.id, action: 'create-inventory-export',
            details: `User created inventory export '${newExport.export_code}' (ID: ${newExport.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(201).json(newExport);
    } catch (error) { next(error); }
};
export const getAllExports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const exports = await InventoryModel.findAllExports(limit, offset);
        res.status(200).json(exports);
    } catch (error) { next(error); }
};

export const getExportById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const exportData = await InventoryModel.findExportById(id);
        if (!exportData) {
            return res.status(404).json({ message: 'Không tìm thấy phiếu xuất kho.' });
        }
        res.status(200).json(exportData);
    } catch (error) { next(error); }
};

export const cancelExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const user = req.user as User;
        if (!reason) {
            return res.status(400).json({ message: 'Vui lòng cung cấp lý do hủy.' });
        }
        await InventoryModel.cancelExport(id, reason, user.id);
        res.status(200).json({ message: 'Hủy phiếu xuất kho thành công.' });
    } catch (error) {
        // Xử lý lỗi cụ thể từ model
        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }
        next(error);
    }
};
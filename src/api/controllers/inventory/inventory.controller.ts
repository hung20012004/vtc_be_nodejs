import { Request, Response, NextFunction } from 'express';
import * as InventoryModel from '../../models/inventory/inventory.model';
import { User } from '../../types/authentication/user.type';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';

// ===========================================
// == PHIẾU NHẬP KHO (IMPORTS) ==
// ===========================================

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
        if (isNaN(id)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        const importData = await InventoryModel.findImportById(id);
        if (!importData) return res.status(404).json({ message: 'Không tìm thấy phiếu nhập kho.' });
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

// ===========================================
// == PHIẾU XUẤT KHO (EXPORTS) ==
// ===========================================

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
        if (isNaN(id)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        const exportData = await InventoryModel.findExportById(id);
        if (!exportData) return res.status(404).json({ message: 'Không tìm thấy phiếu xuất kho.' });
        res.status(200).json(exportData);
    } catch (error) { next(error); }
};

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
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};

export const cancelExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const user = req.user as User;
        if (isNaN(id)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        if (!reason) return res.status(400).json({ message: 'Vui lòng cung cấp lý do hủy.' });
        
        await InventoryModel.cancelExport(id, reason, user.id);
        await createActivityLog({
            user_id: user.id, action: 'cancel-inventory-export',
            details: `User cancelled inventory export ID: ${id} with reason: ${reason}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json({ message: 'Hủy phiếu xuất kho thành công.' });
    } catch (error) {
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error);
    }
};

// ===========================================
// == KIỂM KHO (CHECKS) ==
// ===========================================

export const getBranchInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branchId = parseInt(req.params.branchId, 10);
        if (isNaN(branchId)) return res.status(400).json({ message: 'ID chi nhánh không hợp lệ.' });
        const inventory = await InventoryModel.getInventoryByBranch(branchId);
        res.status(200).json(inventory);
    } catch (error) { next(error); }
};

export const getAllChecks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const { checks, total } = await InventoryModel.findAllChecks(limit, offset);
        res.status(200).json({
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
            data: checks,
        });
    } catch (error) { next(error); }
};

export const getCheckById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkId = parseInt(req.params.checkId, 10);
        if (isNaN(checkId)) return res.status(400).json({ message: 'ID phiếu không hợp lệ.' });
        const checkDetails = await InventoryModel.findCheckById(checkId);
        if (!checkDetails) return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm kho.' });
        res.status(200).json(checkDetails);
    } catch (error) { next(error); }
};

export const startNewCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { branchId, notes } = req.body;
        if (!branchId) return res.status(400).json({ message: 'Vui lòng cung cấp branchId.' });
        const newCheck = await InventoryModel.createCheck(branchId, user.id, notes);
        await createActivityLog({
            user_id: user.id, action: 'start-inventory-check',
            details: `User started inventory check (ID: ${newCheck.id}) for branch ID: ${branchId}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newCheck);
    } catch (error) { next(error); }
};

export const addItemToCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkId = parseInt(req.params.checkId, 10);
        const { variantId, countedQuantity } = req.body;
        if (isNaN(checkId)) return res.status(400).json({ message: 'ID phiếu không hợp lệ.' });
        if (!variantId || countedQuantity === undefined) return res.status(400).json({ message: 'Vui lòng cung cấp variantId và countedQuantity.' });
        const newItem = await InventoryModel.addCheckItem(checkId, variantId, countedQuantity);
        res.status(201).json(newItem);
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};

export const updateItemInCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkId = parseInt(req.params.checkId, 10);
        const itemId = parseInt(req.params.itemId, 10);
        const { countedQuantity } = req.body;
        if (isNaN(checkId) || isNaN(itemId)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        if (countedQuantity === undefined || countedQuantity < 0) return res.status(400).json({ message: 'Số lượng đếm không hợp lệ.' });
        const updatedItem = await InventoryModel.updateCheckItem(checkId, itemId, countedQuantity);
        if (!updatedItem) return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong phiếu kiểm kho.' });
        res.status(200).json(updatedItem);
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};

export const removeItemFromCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkId = parseInt(req.params.checkId, 10);
        const itemId = parseInt(req.params.itemId, 10);
        if (isNaN(checkId) || isNaN(itemId)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        const success = await InventoryModel.removeCheckItem(checkId, itemId);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong phiếu kiểm kho.' });
        res.status(204).send();
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};

export const deleteCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const checkId = parseInt(req.params.checkId, 10);
        if (isNaN(checkId)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        const success = await InventoryModel.deleteCheck(checkId);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm kho hoặc phiếu đã được hoàn thành.' });
        await createActivityLog({
            user_id: user.id, action: 'delete-inventory-check',
            details: `User deleted inventory check (ID: ${checkId})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};

export const completeCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const checkId = parseInt(req.params.checkId, 10);
        if (isNaN(checkId)) return res.status(400).json({ message: 'ID phiếu không hợp lệ.' });
        await InventoryModel.finalizeCheck(checkId);
        await createActivityLog({
            user_id: user.id, action: 'complete-inventory-check',
            details: `User completed and finalized inventory check (ID: ${checkId})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json({ message: 'Hoàn tất kiểm kho và cập nhật số lượng thành công.' });
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};
// BƯỚC 1: Nhân viên kho tạo yêu cầu
export const requestImport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...importData } = req.body;
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết phiếu nhập (details) là bắt buộc.' });
        }
        const user = req.user as User;
        const newRequest = await InventoryModel.requestImport(importData, details, user.id);
        // ... (ghi log)
        res.status(201).json(newRequest);
    } catch (error) { next(error); }
};

// BƯỚC 2: Quản lý duyệt/hủy
export const manageImportRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const importId = parseInt(req.params.id, 10);
        const { action, ...data } = req.body; // action: 'approve' | 'cancel'
        const user = req.user as User;

        if (action !== 'approve' && action !== 'cancel') {
            return res.status(400).json({ message: 'Hành động không hợp lệ.' });
        }
        
        const result = await InventoryModel.approveOrCancelImport(importId, action, data, user.id);
        // ... (ghi log)
        res.status(200).json(result);
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};

// BƯỚC 3: Kế toán xác nhận thanh toán
export const setImportPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const importId = parseInt(req.params.id, 10);
        const success = await InventoryModel.markAsPaid(importId);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy phiếu hoặc phiếu chưa được duyệt.' });
        // ... (ghi log)
        res.status(200).json({ message: 'Đã cập nhật trạng thái thanh toán.' });
    } catch (error) { next(error); }
};

// BƯỚC 4: Nhân viên kho nhận hàng
export const receiveImportShipment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const importId = parseInt(req.params.id, 10);
        const user = req.user as User;
        const success = await InventoryModel.receiveImport(importId, user.id);
        if (!success) return res.status(400).json({ message: 'Hành động thất bại.' });
        // ... (ghi log)
        res.status(200).json({ message: 'Xác nhận nhận hàng thành công. Tồn kho đã được cập nhật.' });
    } catch (error) { 
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error); 
    }
};
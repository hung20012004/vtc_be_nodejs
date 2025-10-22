import { Request, Response, NextFunction } from 'express';
import { User } from '../../types/authentication/user.type'; // Điều chỉnh đường dẫn nếu cần
import { createActivityLog } from '../../models/authentication/user_activity_logs.model'; // Điều chỉnh đường dẫn nếu cần
import * as CheckModel from '../../models/inventory/inventoryCheck.model'; // Điều chỉnh đường dẫn nếu cần

// Helper function
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Đã xảy ra lỗi.') => {
    console.error("Inventory Check Controller Error:", error);
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

// ===========================================
// == KIỂM KHO (CHECKS) ==
// ===========================================

export const getAllChecks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const { checks, total } = await CheckModel.findAllChecks(limit, offset);
        res.status(200).json({
            data: checks,
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(total / limit),
                totalItems: total
            },
        });
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy danh sách phiếu kiểm kho.');
    }
};

export const getCheckById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkIdParam = req.params.checkId;
        const checkId = parseInt(checkIdParam, 10);
        if (isNaN(checkId)) return res.status(400).json({ message: `ID phiếu kiểm kho không hợp lệ: ${checkIdParam}` });

        const checkDetails = await CheckModel.findCheckById(checkId);
        if (!checkDetails) return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm kho.' });
        res.status(200).json(checkDetails);
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy chi tiết phiếu kiểm kho.');
    }
};

export const startNewCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { branchId, notes } = req.body;
        if (!branchId || isNaN(parseInt(branchId, 10))) {
             return res.status(400).json({ message: 'Vui lòng cung cấp ID chi nhánh (branchId) hợp lệ.' });
        }
        const newCheck = await CheckModel.createCheck(parseInt(branchId, 10), user.id, notes);
        await createActivityLog({
            user_id: user.id, action: 'start-inventory-check',
            details: `User started inventory check (ID: ${newCheck.id}) for branch ID: ${branchId}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newCheck);
    } catch (error) {
        handleError(res, error, 'Lỗi khi bắt đầu phiếu kiểm kho.');
    }
};

export const addItemToCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkIdParam = req.params.checkId;
        const checkId = parseInt(checkIdParam, 10);
        const { variantId, countedQuantity } = req.body;

        if (isNaN(checkId)) return res.status(400).json({ message: `ID phiếu kiểm kho không hợp lệ: ${checkIdParam}` });
        if (!variantId || isNaN(parseInt(variantId, 10))) return res.status(400).json({ message: 'Vui lòng cung cấp variantId hợp lệ.' });
        if (countedQuantity === undefined || isNaN(parseInt(countedQuantity, 10)) || parseInt(countedQuantity, 10) < 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp số lượng đếm được (countedQuantity) là số không âm.' });
        }

        const newItem = await CheckModel.addCheckItem(checkId, parseInt(variantId, 10), parseInt(countedQuantity, 10));
        res.status(201).json(newItem);
    } catch (error) {
        handleError(res, error, 'Lỗi khi thêm sản phẩm vào phiếu kiểm kho.');
    }
};

export const updateItemInCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkIdParam = req.params.checkId;
        const itemIdParam = req.params.itemId;
        const checkId = parseInt(checkIdParam, 10);
        const itemId = parseInt(itemIdParam, 10);
        const { countedQuantity } = req.body;

        if (isNaN(checkId)) return res.status(400).json({ message: `ID phiếu kiểm kho không hợp lệ: ${checkIdParam}` });
        if (isNaN(itemId)) return res.status(400).json({ message: `ID item không hợp lệ: ${itemIdParam}` });
        if (countedQuantity === undefined || isNaN(parseInt(countedQuantity, 10)) || parseInt(countedQuantity, 10) < 0) {
            return res.status(400).json({ message: 'Số lượng đếm được (countedQuantity) không hợp lệ.' });
        }

        const updatedItem = await CheckModel.updateCheckItem(checkId, itemId, parseInt(countedQuantity, 10));
        if (!updatedItem) return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong phiếu kiểm kho.' });
        res.status(200).json(updatedItem);
    } catch (error) {
        handleError(res, error, 'Lỗi khi cập nhật sản phẩm trong phiếu kiểm kho.');
    }
};

export const removeItemFromCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkIdParam = req.params.checkId;
        const itemIdParam = req.params.itemId;
        const checkId = parseInt(checkIdParam, 10);
        const itemId = parseInt(itemIdParam, 10);

        if (isNaN(checkId)) return res.status(400).json({ message: `ID phiếu kiểm kho không hợp lệ: ${checkIdParam}` });
        if (isNaN(itemId)) return res.status(400).json({ message: `ID item không hợp lệ: ${itemIdParam}` });

        const success = await CheckModel.removeCheckItem(checkId, itemId);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong phiếu kiểm kho hoặc không thể xóa.' });
        res.status(204).send(); // No Content
    } catch (error) {
        handleError(res, error, 'Lỗi khi xóa sản phẩm khỏi phiếu kiểm kho.');
    }
};

export const deleteCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const checkIdParam = req.params.checkId;
        const checkId = parseInt(checkIdParam, 10);
        if (isNaN(checkId)) return res.status(400).json({ message: `ID phiếu kiểm kho không hợp lệ: ${checkIdParam}` });

        const success = await CheckModel.deleteCheck(checkId);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm kho hoặc phiếu đã được hoàn thành/hủy.' });

        await createActivityLog({
            user_id: user.id, action: 'delete-inventory-check',
            details: `User deleted inventory check (ID: ${checkId})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send(); // No Content
    } catch (error) {
        handleError(res, error, 'Lỗi khi xóa phiếu kiểm kho.');
    }
};

export const completeCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const checkIdParam = req.params.checkId;
        const checkId = parseInt(checkIdParam, 10);
        if (isNaN(checkId)) return res.status(400).json({ message: `ID phiếu kiểm kho không hợp lệ: ${checkIdParam}` });

        await CheckModel.finalizeCheck(checkId);

        await createActivityLog({
            user_id: user.id, action: 'complete-inventory-check',
            details: `User completed and finalized inventory check (ID: ${checkId})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json({ success: true, message: 'Hoàn tất kiểm kho và cập nhật số lượng thành công.' });
    } catch (error) {
        handleError(res, error, 'Lỗi khi hoàn tất phiếu kiểm kho.');
    }
};
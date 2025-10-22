import { Request, Response, NextFunction } from 'express';
import { User } from '../../types/authentication/user.type'; // Điều chỉnh đường dẫn nếu cần
import { createActivityLog } from '../../models/authentication/user_activity_logs.model'; // Điều chỉnh đường dẫn nếu cần
import * as ImportModel from '../../models/inventory/inventoryImport.model'; // Điều chỉnh đường dẫn nếu cần

// Helper function (có thể đưa ra file utils riêng)
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Đã xảy ra lỗi.') => {
    console.error("Inventory Import Controller Error:", error);
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

// ===========================================
// == PHIẾU NHẬP KHO (IMPORTS) ==
// ===========================================

export const getAllImports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const importsPromise = ImportModel.findAllImports(limit, offset);
        const totalPromise = ImportModel.countAllImports();
        const [imports, total] = await Promise.all([importsPromise, totalPromise]);

        res.status(200).json({
            data: imports,
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy danh sách phiếu nhập kho.');
    }
};

export const getImportById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) return res.status(400).json({ message: `ID phiếu nhập không hợp lệ: ${idParam}` });

        const importData = await ImportModel.findImportById(id);
        if (!importData) return res.status(404).json({ message: 'Không tìm thấy phiếu nhập kho.' });
        res.status(200).json(importData);
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy chi tiết phiếu nhập kho.');
    }
};

// BƯỚC 1: Nhân viên kho tạo yêu cầu nhập hàng
export const requestImport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...importData } = req.body;
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết phiếu nhập (details) là bắt buộc và phải là mảng không rỗng.' });
        }
        const user = req.user as User;
        const newRequest = await ImportModel.requestImport(importData, details, user.id);
        await createActivityLog({
            user_id: user.id, action: 'request-inventory-import',
            details: `User requested inventory import '${newRequest.import_code}' (ID: ${newRequest.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newRequest);
    } catch (error) {
        handleError(res, error, 'Lỗi khi tạo yêu cầu nhập kho.');
    }
};

// BƯỚC 2: Quản lý duyệt (approve), từ chối (reject) hoặc hủy (cancel) yêu cầu
export const reviewImportRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const importId = parseInt(idParam, 10);
        const { action, ...data } = req.body as { action: 'approve' | 'reject' | 'cancel', supplier_id?: number; details?: any[], note?: string };
        const user = req.user as User;

        if (isNaN(importId)) return res.status(400).json({ message: `ID phiếu nhập không hợp lệ: ${idParam}` });
        if (!action || !['approve', 'reject', 'cancel'].includes(action)) {
            return res.status(400).json({ message: "Hành động (action) phải là 'approve', 'reject', hoặc 'cancel'." });
        }
        if (action === 'approve' && (!data.supplier_id || !data.details || data.details.length === 0)) {
             return res.status(400).json({ message: 'Phê duyệt yêu cầu cần có supplier_id và details (bao gồm id, import_quantity, import_price).' });
        }
         if ((action === 'reject' || action === 'cancel') && !data.note) {
             return res.status(400).json({ message: 'Từ chối hoặc Hủy yêu cầu cần có ghi chú (note).' });
         }

        const result = await ImportModel.reviewImportRequest(importId, action, data, user.id);

        await createActivityLog({
            user_id: user.id, action: `${action}-inventory-import`,
            details: `User ${action}d inventory import request ID: ${importId}. Note: ${data.note || 'N/A'}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(result);
    } catch (error) {
        handleError(res, error, `Lỗi khi ${req.body.action || 'xử lý'} yêu cầu nhập kho.`);
    }
};

// BƯỚC 3: Kế toán xác nhận thanh toán
export const setImportPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const importId = parseInt(idParam, 10);
        const user = req.user as User;

        if (isNaN(importId)) return res.status(400).json({ message: `ID phiếu nhập không hợp lệ: ${idParam}` });

        const success = await ImportModel.markAsPaid(importId, user.id);
        if (!success) {
            return res.status(400).json({ message: 'Không tìm thấy phiếu nhập kho, phiếu chưa được phê duyệt, hoặc đã được thanh toán trước đó.' });
        }

        await createActivityLog({
            user_id: user.id, action: 'mark-inventory-import-paid',
            details: `User marked inventory import ID: ${importId} as paid`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json({ success: true, message: 'Đã cập nhật trạng thái thanh toán thành công.' });
    } catch (error) {
        handleError(res, error, 'Lỗi khi cập nhật trạng thái thanh toán.');
    }
};

// BƯỚC 4A: Nhân viên kho xác nhận nhận hàng
export const receiveImportShipment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const importId = parseInt(idParam, 10);
        const user = req.user as User;

        if (isNaN(importId)) return res.status(400).json({ message: `ID phiếu nhập không hợp lệ: ${idParam}` });

        const success = await ImportModel.receiveImport(importId, user.id);

        await createActivityLog({
            user_id: user.id, action: 'receive-inventory-import',
            details: `User confirmed receipt for inventory import ID: ${importId}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json({ success: true, message: 'Xác nhận nhận hàng thành công. Tồn kho đã được cập nhật.' });
    } catch (error) {
        handleError(res, error, 'Lỗi khi xác nhận nhận hàng nhập kho.');
    }
};

// BƯỚC 4B: Nhân viên kho từ chối nhận hàng
export const rejectImportReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const importId = parseInt(idParam, 10);
        const { reason } = req.body;
        const user = req.user as User;

        if (isNaN(importId)) return res.status(400).json({ message: `ID phiếu nhập không hợp lệ: ${idParam}` });
        if (!reason) return res.status(400).json({ message: 'Vui lòng cung cấp lý do từ chối nhận hàng (reason).' });

        const success = await ImportModel.rejectReceipt(importId, user.id, reason);

        await createActivityLog({
            user_id: user.id, action: 'reject-inventory-receipt',
            details: `User rejected receipt for inventory import ID: ${importId}. Reason: ${reason}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json({ success: true, message: 'Đã từ chối nhận hàng. Tồn kho không thay đổi.' });
    } catch (error) {
        handleError(res, error, 'Lỗi khi từ chối nhận hàng nhập kho.');
    }
};
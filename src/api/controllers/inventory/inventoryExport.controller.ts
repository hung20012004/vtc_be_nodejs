import { Request, Response, NextFunction } from 'express';
import { User } from '../../types/authentication/user.type'; // Điều chỉnh đường dẫn nếu cần
import { createActivityLog } from '../../models/authentication/user_activity_logs.model'; // Điều chỉnh đường dẫn nếu cần
import * as ExportModel from '../../models/inventory/inventoryExport.model'; // Điều chỉnh đường dẫn nếu cần

// Helper function
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Đã xảy ra lỗi.') => {
    console.error("Inventory Export Controller Error:", error);
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

// ===========================================
// == PHIẾU XUẤT KHO & CHUYỂN KHO (EXPORTS) ==
// ===========================================

export const getAllExports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const exportsPromise = ExportModel.findAllExports(limit, offset);
        const totalPromise = ExportModel.countAllExports();
        const [exportsData, total] = await Promise.all([exportsPromise, totalPromise]);

        res.status(200).json({
            data: exportsData,
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy danh sách phiếu xuất kho.');
    }
};

export const getExportById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) return res.status(400).json({ message: `ID phiếu xuất không hợp lệ: ${idParam}` });

        const exportData = await ExportModel.findExportById(id);
        if (!exportData) return res.status(404).json({ message: 'Không tìm thấy phiếu xuất kho.' });
        res.status(200).json(exportData);
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy chi tiết phiếu xuất kho.');
    }
};

// Tạo phiếu xuất hủy hoặc chuyển kho
export const createExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...exportData } = req.body;
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết phiếu xuất (details) là bắt buộc và phải là mảng không rỗng.' });
        }
        if (!exportData.type || ![2, 3].includes(exportData.type)) {
             return res.status(400).json({ message: 'Loại phiếu xuất (type) không hợp lệ. Chỉ chấp nhận 2 (Hủy) hoặc 3 (Chuyển kho).' });
        }
        if (exportData.type === 3 && !exportData.to_branch_id) {
            return res.status(400).json({ message: 'Phiếu chuyển kho cần có chi nhánh đích (to_branch_id).' });
        }

        const user = req.user as User;
        const newExport = await ExportModel.createExport(exportData, details, user.id);

        await createActivityLog({
            user_id: user.id, action: 'create-inventory-export',
            details: `User created inventory export '${newExport.export_code}' (ID: ${newExport.id}, Type: ${newExport.type})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newExport);
    } catch (error) {
        handleError(res, error, 'Lỗi khi tạo phiếu xuất/chuyển kho.');
    }
};

// Hủy phiếu xuất/chuyển kho
export const cancelExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const id = parseInt(idParam, 10);
        const { reason } = req.body;
        const user = req.user as User;

        if (isNaN(id)) return res.status(400).json({ message: `ID phiếu xuất không hợp lệ: ${idParam}` });
        if (!reason) return res.status(400).json({ message: 'Vui lòng cung cấp lý do hủy (reason).' });

        const success = await ExportModel.cancelExport(id, reason, user.id);

        await createActivityLog({
            user_id: user.id, action: 'cancel-inventory-export',
            details: `User cancelled inventory export ID: ${id}. Reason: ${reason}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json({ success: true, message: 'Hủy phiếu xuất kho thành công. Tồn kho đã được hoàn trả.' });
    } catch (error) {
        handleError(res, error, 'Lỗi khi hủy phiếu xuất kho.');
    }
};

// Chi nhánh đích xác nhận nhận hàng chuyển kho
export const receiveTransferShipment = async (req: Request, res: Response, next: NextFunction) => {
     try {
         const idParam = req.params.id; // ID của phiếu *xuất* chuyển kho
         const exportId = parseInt(idParam, 10);
         const user = req.user as User; // Người nhận hàng tại chi nhánh đích

         if (isNaN(exportId)) return res.status(400).json({ message: `ID phiếu chuyển kho không hợp lệ: ${idParam}` });

         const success = await ExportModel.receiveTransfer(exportId, user.id);

         await createActivityLog({
             user_id: user.id, action: 'receive-inventory-transfer',
             details: `User confirmed receipt of inventory transfer (Export ID: ${exportId})`,
             ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
         });

         res.status(200).json({ success: true, message: 'Xác nhận nhận hàng chuyển kho thành công. Tồn kho chi nhánh đã được cập nhật.' });
     } catch (error) {
         handleError(res, error, 'Lỗi khi xác nhận nhận hàng chuyển kho.');
     }
 };
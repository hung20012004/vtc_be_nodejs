import { Request, Response, NextFunction } from 'express';
import { User } from '../../types/authentication/user.type'; // Adjust path if needed
import { createActivityLog } from '../../models/authentication/user_activity_logs.model'; // Adjust path if needed
import * as ExportModel from '../../models/inventory/inventoryExport.model'; // Adjust path if needed
import { ExportStatus, InventoryExport } from '../../types/inventory/inventory.type'; // Adjust path if needed

// Helper function
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Đã xảy ra lỗi.') => {
    console.error("Inventory Export/Transfer Controller Error:", error);
    if (error instanceof Error) {
        // Check for specific constraint errors if needed
        // if (error.message.includes('inventory_exports_status_check')) {
        //     return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
        // }
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

// Helper function to parse ID
const getIdParam = (req: Request): number | null => {
    const idParam = req.params.id;
    const id = parseInt(idParam, 10);
    return isNaN(id) ? null : id;
};


// ===========================================
// == LẤY DANH SÁCH & CHI TIẾT ==
// ===========================================

/**
 * Lấy danh sách phiếu xuất/chuyển kho (có phân trang và filter)
 * Query params: page, limit, type (2 or 3), status, branchId (lọc theo from hoặc to)
 */
export const getAllExports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        // Filters
        const type = req.query.type ? parseInt(req.query.type as string, 10) : undefined;
        const status = req.query.status as string | undefined;
        const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;

        if (type !== undefined && ![2, 3].includes(type)) {
             return res.status(400).json({ message: 'Lọc theo type chỉ chấp nhận 2 hoặc 3.'});
        }
         if (branchId !== undefined && isNaN(branchId)) {
             return res.status(400).json({ message: 'branchId không hợp lệ.'});
        }


        const filter = { type, status, branchId };

        const exportsPromise = ExportModel.findAllExportsWithNames(limit, offset, filter);
        const totalPromise = ExportModel.countAllExports(filter); // Count with filter
        const [exportsData, total] = await Promise.all([exportsPromise, totalPromise]);

        res.status(200).json({
            data: exportsData.data, // Access the data array from the result
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

/**
 * Lấy chi tiết phiếu xuất/chuyển kho theo ID
 */
export const getExportById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getIdParam(req);
        if (id === null) return res.status(400).json({ message: `ID phiếu xuất không hợp lệ.` });

        const exportData = await ExportModel.findExportById(id); // Model now returns details and names
        if (!exportData) return res.status(404).json({ message: 'Không tìm thấy phiếu xuất kho.' });
        res.status(200).json(exportData);
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy chi tiết phiếu xuất kho.');
    }
};

// ===========================================
// == QUY TRÌNH YÊU CẦU/CHUYỂN KHO (type=3) ==
// ===========================================

/**
 * BƯỚC 1: NV Chi nhánh tạo yêu cầu chuyển kho
 * Body: { from_branch_id: number, notes?: string, details: [{ product_id, variant_id, quantity }] }
 */
export const requestTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...requestData } = req.body;
        if (!requestData.from_branch_id || requestData.from_branch_id === 0) { // CN yêu cầu phải khác 0
             return res.status(400).json({ message: 'Vui lòng cung cấp chi nhánh yêu cầu hợp lệ (from_branch_id).' });
        }
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết sản phẩm yêu cầu (details) là bắt buộc.' });
        }
        const user = req.user as User;

        const newRequest = await ExportModel.requestTransfer(requestData, details, user.id);

        await createActivityLog({
            user_id: user.id, action: 'request-inventory-transfer',
            details: `User requested inventory transfer '${newRequest.export_code}' (ID: ${newRequest.id}) from branch ${requestData.from_branch_id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newRequest);
    } catch (error) {
        handleError(res, error, 'Lỗi khi tạo yêu cầu chuyển kho.');
    }
};

/**
 * BƯỚC 2: QL Chi nhánh duyệt/từ chối yêu cầu
 * PATCH /:id/review-branch
 * Body: { action: 'approve' | 'reject', note?: string }
 */
export const reviewBranchTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getIdParam(req);
        const { action, note } = req.body as { action: 'approve' | 'reject', note?: string };
        const user = req.user as User; // User is Branch Manager

        if (id === null) return res.status(400).json({ message: `ID yêu cầu không hợp lệ.` });
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: "Hành động (action) phải là 'approve' hoặc 'reject'." });
        }
        if (action === 'reject' && !note) {
            return res.status(400).json({ message: 'Cần có lý do (note) khi từ chối.' });
        }

        const updatedRequest = await ExportModel.reviewBranchTransfer(id, action, user.id, note);

        await createActivityLog({
            user_id: user.id, action: `branch-${action}-transfer`,
            details: `Branch Manager ${action}d inventory transfer request ID: ${id}. Note: ${note || 'N/A'}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(updatedRequest);
    } catch (error) {
        handleError(res, error, `Lỗi khi QL Chi nhánh ${req.body.action} yêu cầu.`);
    }
};

/**
 * BƯỚC 3: QL Kho tổng duyệt/từ chối yêu cầu
 * PATCH /:id/review-warehouse
 * Body: { action: 'approve' | 'reject', note?: string }
 */
export const reviewWarehouseTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getIdParam(req);
        const { action, note } = req.body as { action: 'approve' | 'reject', note?: string };
        const user = req.user as User; // User is Warehouse Manager

        if (id === null) return res.status(400).json({ message: `ID yêu cầu không hợp lệ.` });
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: "Hành động (action) phải là 'approve' hoặc 'reject'." });
        }
        if (action === 'reject' && !note) {
            return res.status(400).json({ message: 'Cần có lý do (note) khi từ chối.' });
        }

        const updatedRequest = await ExportModel.reviewWarehouseTransfer(id, action, user.id, note);

        await createActivityLog({
            user_id: user.id, action: `warehouse-${action}-transfer`,
            details: `Warehouse Manager ${action}d inventory transfer request ID: ${id}. Note: ${note || 'N/A'}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(updatedRequest);
    } catch (error) {
        handleError(res, error, `Lỗi khi QL Kho ${req.body.action} yêu cầu.`);
    }
};

/**
 * BƯỚC 4: NV Kho tổng xác nhận gửi hàng
 * POST /:id/ship
 * Body: {} (Không cần body)
 */
export const shipTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getIdParam(req);
        const user = req.user as User; // User is Warehouse Staff

        if (id === null) return res.status(400).json({ message: `ID phiếu chuyển không hợp lệ.` });

        const updatedRequest = await ExportModel.shipTransfer(id, user.id);

        await createActivityLog({
            user_id: user.id, action: 'ship-inventory-transfer',
            details: `Warehouse Staff confirmed shipment for inventory transfer ID: ${id}.`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(updatedRequest);
    } catch (error) {
        handleError(res, error, 'Lỗi khi xác nhận gửi hàng chuyển kho.');
    }
};

/**
 * BƯỚC 5: NV Chi nhánh xác nhận nhận hàng
 * POST /:id/receive-shipment
 * Body: {} (Không cần body)
 */
export const receiveTransferShipment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getIdParam(req); // ID của phiếu *xuất* chuyển kho
        const user = req.user as User; // Người nhận hàng tại chi nhánh đích

        if (id === null) return res.status(400).json({ message: `ID phiếu chuyển kho không hợp lệ.` });

        const updatedRequest = await ExportModel.receiveTransferShipment(id, user.id);

        await createActivityLog({
            user_id: user.id, action: 'receive-inventory-transfer',
            details: `User confirmed receipt of inventory transfer (Export ID: ${id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json({
            message: 'Xác nhận nhận hàng chuyển kho thành công. Tồn kho chi nhánh đã được cập nhật.',
            data: updatedRequest
        });
    } catch (error) {
        handleError(res, error, 'Lỗi khi xác nhận nhận hàng chuyển kho.');
    }
 };


/**
 * Hủy yêu cầu/phiếu chuyển kho (type=3)
 * PATCH /:id/cancel-transfer
 * Body: { reason: string }
 */
export const cancelTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getIdParam(req);
        const { reason } = req.body;
        const user = req.user as User; // Người thực hiện hủy

        if (id === null) return res.status(400).json({ message: `ID phiếu chuyển không hợp lệ.` });
        if (!reason) return res.status(400).json({ message: 'Vui lòng cung cấp lý do hủy (reason).' });

        const updatedRequest = await ExportModel.cancelTransfer(id, reason, user.id);

        await createActivityLog({
            user_id: user.id, action: 'cancel-inventory-transfer',
            details: `User cancelled inventory transfer request/shipment ID: ${id}. Reason: ${reason}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json({
            message: 'Hủy yêu cầu/phiếu chuyển kho thành công.' + (updatedRequest?.status === 'cancelled' && ['shipped'].includes(updatedRequest?.status || '') ? ' Tồn kho nguồn đã được hoàn trả.' : ''), // Kiểm tra trạng thái trước đó để thông báo hoàn kho
            data: updatedRequest
        });
    } catch (error) {
        handleError(res, error, 'Lỗi khi hủy yêu cầu/phiếu chuyển kho.');
    }
};


// ===========================================
// == XUẤT HỦY HÀNG (type=2) ==
// ===========================================

/**
 * Tạo phiếu xuất hủy hàng
 * POST /disposal
 * Body: { export_code?: string, notes?: string, details: [{ product_id, variant_id, quantity }] }
 */
export const createDisposalExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { details, ...exportData } = req.body;
        if (!details || !Array.isArray(details) || details.length === 0) {
            return res.status(400).json({ message: 'Chi tiết sản phẩm hủy (details) là bắt buộc.' });
        }
        const user = req.user as User;

        const newExport = await ExportModel.createDisposalExport(exportData, details, user.id);

        await createActivityLog({
            user_id: user.id, action: 'create-disposal-export',
            details: `User created disposal export '${newExport.export_code}' (ID: ${newExport.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newExport);
    } catch (error) {
        handleError(res, error, 'Lỗi khi tạo phiếu xuất hủy hàng.');
    }
};

// Lưu ý: Hủy phiếu hủy hàng thường không cần thiết, nhưng nếu cần có thể tạo hàm tương tự cancelTransfer nhưng không hoàn kho.
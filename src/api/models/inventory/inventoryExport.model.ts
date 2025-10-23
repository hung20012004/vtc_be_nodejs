import pool from '../../../config/db';
import { PoolClient } from 'pg';
// Adjust path for types if needed
import { InventoryExport, InventoryExportDetail, ExportStatus } from '../../types/inventory/inventory.type';
// Adjust path for User type if needed
import { User } from '../../types/authentication/user.type';


// --- Type Definitions ---
// Input for creating a Transfer Request (Type 3)
type CreateTransferRequestInput = Pick<InventoryExport, 'from_branch_id' | 'notes'>; // from_branch_id is the requesting branch
// Input for creating a Disposal Export (Type 2)
type CreateDisposalInput = Pick<InventoryExport, 'export_code' | 'notes'>;
// Input for export details
type CreateExportDetailInput = Omit<InventoryExportDetail, 'id' | 'export_id'>;

// Filter options for finding exports
interface ExportFilterOptions {
    type?: number;
    status?: string;
    branchId?: number; // Filter by requesting branch (from) or source branch (to)
}

// --- Helper Function ---
/**
 * Fetches detailed export/transfer data including related names.
 */
const findExportByIdWithDetails = async (id: number, client?: PoolClient): Promise<(InventoryExport & { details: InventoryExportDetail[] }) | null> => {
    const db = client || pool;
    const exportQuery = `
        SELECT
            ie.*,
            -- Related user names
            u_req.name as requested_by_name,
            u_bm.name as branch_manager_name,
            u_wm.name as warehouse_manager_name,
            u_ship.name as shipped_by_name,
            u_rec.name as received_by_name,
            -- Related branch names
            fb.name as from_branch_name, -- Requesting branch name (Type 3) / Source branch (Type 2 = Kho Tổng)
            tb.name as to_branch_name   -- Source warehouse name (Type 3 = Kho Tổng) / NULL (Type 2)
        FROM inventory_exports ie
        LEFT JOIN users u_req ON ie.requested_by = u_req.id
        LEFT JOIN users u_bm ON ie.branch_manager_id = u_bm.id
        LEFT JOIN users u_wm ON ie.warehouse_manager_id = u_wm.id
        LEFT JOIN users u_ship ON ie.shipped_by = u_ship.id
        LEFT JOIN users u_rec ON ie.received_by = u_rec.id
        LEFT JOIN branches fb ON ie.from_branch_id = fb.id -- Join requesting branch
        LEFT JOIN branches tb ON ie.to_branch_id = tb.id   -- Join source warehouse (0)
        WHERE ie.id = $1`;
    const exportResult = await db.query(exportQuery, [id]);
    if (exportResult.rows.length === 0) return null;

    // Fetch details
    const detailsQuery = `
        SELECT ied.*,
               p.name as product_name, p.images->>'thumbnail' as product_image,
               pv.name as variant_name, pv.sku, pv.image as variant_image
        FROM inventory_export_details ied
        JOIN product_variants pv ON ied.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ied.export_id = $1 ORDER BY p.name, pv.name`;
    const detailsResult = await db.query(detailsQuery, [id]);

    const details = detailsResult.rows.map(d => ({
        ...d,
        quantity: parseInt(d.quantity, 10)
    }));

    const exportData = exportResult.rows[0];
     // Ensure 'Kho Tổng' is displayed correctly for source warehouse (to_branch_id = 0)
     if (exportData.to_branch_id === 0 && !exportData.to_branch_name) {
         exportData.to_branch_name = 'Kho Tổng';
     }
     // For type 2, from_branch_name should also be 'Kho Tổng'
      if (exportData.type === 2 && exportData.from_branch_id === 0 && !exportData.from_branch_name) {
         exportData.from_branch_name = 'Kho Tổng';
     }


    return {
        ...exportData,
        total_quantity: exportData.total_quantity ? parseInt(exportData.total_quantity, 10) : null,
        details: details
    };
};


// ===========================================
// == YÊU CẦU / CHUYỂN KHO NỘI BỘ (type=3) ==
// ===========================================

/**
 * BƯỚC 1: Nhân viên chi nhánh tạo Yêu cầu chuyển kho.
 * `from_branch_id` = Chi nhánh yêu cầu.
 * `to_branch_id` = 0 (Kho nguồn).
 */
export const requestTransfer = async (
    requestData: CreateTransferRequestInput,
    detailsData: CreateExportDetailInput[],
    requestedBy: number
): Promise<InventoryExport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { from_branch_id, notes } = requestData; // from_branch_id is the requesting branch
        const to_branch_id = 0; // Source warehouse is always 0
        const exportCode = `YC-${from_branch_id}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
        let totalQuantity = 0;

        // Create main export record with status 'branch_pending'
        const exportResult = await client.query(
            `INSERT INTO inventory_exports (export_code, type, from_branch_id, to_branch_id, notes, created_by, requested_by, requested_at, status)
             VALUES ($1, 3, $2, $3, $4, $5, $5, NOW(), 'branch_pending') RETURNING id`,
            [exportCode, from_branch_id, to_branch_id, notes, requestedBy]
        );
        const newExportId = exportResult.rows[0].id;

        // Add details
        const detailPromises = detailsData.map(detail => {
            if (!detail.variant_id || !detail.quantity || detail.quantity <= 0) {
                throw new Error('Mỗi sản phẩm yêu cầu phải có variant_id và số lượng > 0.');
            }
            totalQuantity += detail.quantity;
            return client.query(
                `INSERT INTO inventory_export_details (export_id, product_id, variant_id, quantity)
                 VALUES ($1, $2, $3, $4)`,
                [newExportId, detail.product_id, detail.variant_id, detail.quantity]
            );
        });
        await Promise.all(detailPromises);

        // Update total quantity
        await client.query('UPDATE inventory_exports SET total_quantity = $1 WHERE id = $2', [totalQuantity, newExportId]);

        await client.query('COMMIT');
        const createdRequest = await findExportByIdWithDetails(newExportId, client);
        if (!createdRequest) throw new Error("Không thể lấy lại yêu cầu vừa tạo.");
        return createdRequest;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in requestTransfer:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 2: Quản lý Chi nhánh duyệt/từ chối yêu cầu.
 */
export const reviewBranchTransfer = async (
    exportId: number,
    action: 'approve' | 'reject',
    branchManagerId: number,
    note?: string
): Promise<InventoryExport | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query("SELECT status, from_branch_id FROM inventory_exports WHERE id = $1 AND type = 3 FOR UPDATE", [exportId]);
        if (!current.rows[0] || current.rows[0].status !== 'branch_pending') {
            throw new Error("Yêu cầu không tồn tại hoặc không ở trạng thái chờ chi nhánh duyệt.");
        }
        // Optional: Check if branchManagerId manages current.rows[0].from_branch_id

        let newStatus: ExportStatus = action === 'approve' ? 'warehouse_pending' : 'branch_rejected';
        let finalNote = note || '';
        if (action === 'approve') finalNote = `Branch Approved by User ${branchManagerId}. ${finalNote}`;
        else finalNote = `Branch Rejected by User ${branchManagerId}: ${finalNote}`;
        if (action === 'reject' && !note) throw new Error("Cần ghi chú lý do từ chối.");

        await client.query(
            `UPDATE inventory_exports
             SET status = $1, branch_manager_id = $2, branch_reviewed_at = NOW(),
                 notes = COALESCE(notes || E'\\n', '') || $3::TEXT, updated_at = NOW()
             WHERE id = $4`,
            [newStatus, branchManagerId, finalNote, exportId]
        );

        await client.query('COMMIT');
        return findExportByIdWithDetails(exportId, client);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error reviewing branch transfer:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 3: Quản lý Kho tổng duyệt/từ chối yêu cầu.
 */
export const reviewWarehouseTransfer = async (
    exportId: number,
    action: 'approve' | 'reject',
    warehouseManagerId: number,
    note?: string
): Promise<InventoryExport | null> => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query("SELECT status FROM inventory_exports WHERE id = $1 AND type = 3 FOR UPDATE", [exportId]);
        if (!current.rows[0] || current.rows[0].status !== 'warehouse_pending') {
            throw new Error("Yêu cầu không tồn tại hoặc không ở trạng thái chờ kho tổng duyệt.");
        }

        let newStatus: ExportStatus = action === 'approve' ? 'processing' : 'warehouse_rejected';
        let finalNote = note || '';
        if (action === 'approve') finalNote = `Warehouse Approved by User ${warehouseManagerId}. ${finalNote}`;
        else finalNote = `Warehouse Rejected by User ${warehouseManagerId}: ${finalNote}`;
        if (action === 'reject' && !note) throw new Error("Cần ghi chú lý do từ chối.");

        await client.query(
            `UPDATE inventory_exports
             SET status = $1, warehouse_manager_id = $2, warehouse_reviewed_at = NOW(),
                 notes = COALESCE(notes || E'\\n', '') || $3::TEXT, updated_at = NOW()
             WHERE id = $4`,
            [newStatus, warehouseManagerId, finalNote, exportId]
        );

        await client.query('COMMIT');
        return findExportByIdWithDetails(exportId, client);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error reviewing warehouse transfer:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 4: Nhân viên Kho tổng xác nhận gửi hàng & Trừ kho tổng (`to_branch_id` = 0).
 */
export const shipTransfer = async (
    exportId: number,
    shippedBy: number
): Promise<InventoryExport | null> => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query("SELECT status, to_branch_id FROM inventory_exports WHERE id = $1 AND type = 3 FOR UPDATE", [exportId]);
        if (!current.rows[0] || current.rows[0].status !== 'processing') {
            throw new Error("Yêu cầu không tồn tại hoặc không ở trạng thái chờ xử lý (processing).");
        }
        const sourceWarehouseId = current.rows[0].to_branch_id; // Source is to_branch_id (should be 0)
        if (sourceWarehouseId !== 0) {
             console.warn(`Warning: Shipping transfer ${exportId} from unexpected source branch ${sourceWarehouseId}`);
             // Proceed cautiously or throw error depending on strictness
        }

        const detailsResult = await client.query("SELECT variant_id, quantity FROM inventory_export_details WHERE export_id = $1", [exportId]);
        const details = detailsResult.rows;
        if (details.length === 0) throw new Error("Yêu cầu không có chi tiết sản phẩm.");

        // Check and deduct stock from source warehouse (0)
        const stockUpdatePromises = details.map(async detail => {
            const quantityToShip = detail.quantity;
            const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2 FOR UPDATE', [sourceWarehouseId, detail.variant_id]);
            const currentStock = stockCheck.rows[0]?.quantity || 0;
            if (currentStock < quantityToShip) {
                throw new Error(`Kho nguồn (ID: ${sourceWarehouseId}) không đủ tồn kho cho variant ${detail.variant_id} (cần ${quantityToShip}, còn ${currentStock}).`);
            }
            await client.query('UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = $2 AND variant_id = $3', [quantityToShip, sourceWarehouseId, detail.variant_id]);
        });
        await Promise.all(stockUpdatePromises);

        // Update export status and shipper info
        await client.query(
            `UPDATE inventory_exports
             SET status = 'shipped', shipped_by = $1, shipped_at = NOW(), export_date = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [shippedBy, exportId]
        );

        await client.query('COMMIT');
        return findExportByIdWithDetails(exportId, client);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error shipping transfer:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 5: Nhân viên Chi nhánh xác nhận nhận hàng & Cộng kho chi nhánh yêu cầu (`from_branch_id`).
 */
export const receiveTransferShipment = async (
    exportId: number,
    receivedBy: number
): Promise<InventoryExport | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Get requesting branch (destination) from from_branch_id
        const current = await client.query("SELECT status, from_branch_id FROM inventory_exports WHERE id = $1 AND type = 3 FOR UPDATE", [exportId]);
        if (!current.rows[0] || current.rows[0].status !== 'shipped') {
            throw new Error("Phiếu chuyển không tồn tại hoặc chưa được gửi đi (status != shipped).");
        }
        const destinationBranchId = current.rows[0].from_branch_id; // Destination is the original requester

        // Update status to 'completed'
        const finalNote = `Received by User ${receivedBy} at branch ${destinationBranchId}`;
        await client.query(
            `UPDATE inventory_exports
             SET status = 'completed', received_by = $1, received_at = NOW(),
                 notes = COALESCE(notes || E'\\n', '') || $2::TEXT, updated_at = NOW()
             WHERE id = $3`,
            [receivedBy, finalNote, exportId]
        );

        // Add stock to destination branch
        const detailsResult = await client.query("SELECT variant_id, quantity FROM inventory_export_details WHERE export_id = $1", [exportId]);
        const inventoryReceivePromises = detailsResult.rows.map(detail => {
             const quantityReceived = detail.quantity;
             return client.query(
                 `INSERT INTO branch_inventories (branch_id, variant_id, quantity)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + EXCLUDED.quantity`,
                 [destinationBranchId, detail.variant_id, quantityReceived]
             );
         });
        await Promise.all(inventoryReceivePromises);

        await client.query('COMMIT');
        return findExportByIdWithDetails(exportId, client);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error receiving transfer shipment:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Hủy yêu cầu/phiếu chuyển kho (type=3). Hoàn kho tổng nếu đã gửi.
 */
export const cancelTransfer = async (
    exportId: number,
    reason: string,
    userId: number
): Promise<InventoryExport | null> => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Get source warehouse ID (to_branch_id = 0)
        const current = await client.query('SELECT status, to_branch_id FROM inventory_exports WHERE id = $1 AND type = 3 FOR UPDATE', [exportId]);
        if (current.rows.length === 0) throw new Error('Không tìm thấy phiếu chuyển kho.');

        const currentStatus = current.rows[0].status as ExportStatus;
        const sourceWarehouseId = current.rows[0].to_branch_id; // Source warehouse (0)

        const allowedCancelStatuses: ExportStatus[] = ['branch_pending', 'warehouse_pending', 'processing', 'shipped'];
        if (!allowedCancelStatuses.includes(currentStatus)) {
            throw new Error(`Không thể hủy yêu cầu/phiếu chuyển kho đang ở trạng thái "${currentStatus}".`);
        }
        if (!reason) throw new Error("Cần có lý do hủy.");

        // Update status to 'cancelled'
        const finalNote = `Cancelled by User ${userId}: ${reason}`;
        await client.query(
            `UPDATE inventory_exports
             SET status = 'cancelled', notes = COALESCE(notes || E'\\n', '') || $2::TEXT, updated_at = NOW()
             WHERE id = $1`,
            [exportId, finalNote]
        );

        // Revert stock to source warehouse (0) IF it was already shipped
        if (currentStatus === 'shipped') {
            const detailsResult = await client.query('SELECT variant_id, quantity FROM inventory_export_details WHERE export_id = $1', [exportId]);
            const inventoryRevertPromises = detailsResult.rows.map(detail =>
                client.query(
                    `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES ($1, $2, $3)
                     ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + EXCLUDED.quantity`,
                    [sourceWarehouseId, detail.variant_id, detail.quantity] // Revert to source (0)
                )
            );
            await Promise.all(inventoryRevertPromises);
             console.log(`Reverted stock to source warehouse ${sourceWarehouseId} for cancelled transfer ${exportId}.`);
        }

        await client.query('COMMIT');
        return findExportByIdWithDetails(exportId, client);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error cancelling transfer:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ===========================================
// == PHIẾU XUẤT HỦY HÀNG (type=2) ==
// ===========================================
/**
 * Tạo phiếu xuất hủy hàng từ kho tổng (0). Trừ kho ngay.
 * `from_branch_id` = 0.
 * `to_branch_id` = NULL.
 */
export const createDisposalExport = async (
    exportData: CreateDisposalInput,
    detailsData: CreateExportDetailInput[],
    createdBy: number
): Promise<InventoryExport> => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { export_code, notes } = exportData;
        const type = 2;
        const from_branch_id = 0; // Always dispose from warehouse 0
        const to_branch_id = null;
        const initialStatus: ExportStatus = 'completed';
        const finalExportCode = export_code || `HUY-${Date.now()}`;
        const finalExportDate = new Date();
        let totalQuantity = 0;

        const exportResult = await client.query(
            `INSERT INTO inventory_exports (export_code, type, from_branch_id, to_branch_id, export_date, notes, created_by, status, requested_by, requested_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, NOW()) RETURNING id`, // requested_by = created_by
            [finalExportCode, type, from_branch_id, to_branch_id, finalExportDate, notes, createdBy, initialStatus]
        );
        const newExportId = exportResult.rows[0].id;

        const detailPromises = detailsData.map(async (detail) => {
             if (!detail.variant_id || !detail.quantity || detail.quantity <= 0) throw new Error('Sản phẩm hủy phải có variant_id và số lượng > 0.');
             const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2 FOR UPDATE', [from_branch_id, detail.variant_id]);
             const currentStock = stockCheck.rows[0]?.quantity || 0;
             if (currentStock < detail.quantity) throw new Error(`Kho tổng không đủ tồn kho variant ${detail.variant_id} để hủy (cần ${detail.quantity}, còn ${currentStock}).`);
             await client.query(`UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = $2 AND variant_id = $3`, [detail.quantity, from_branch_id, detail.variant_id]);
             await client.query(`INSERT INTO inventory_export_details (export_id, product_id, variant_id, quantity) VALUES ($1, $2, $3, $4)`, [newExportId, detail.product_id, detail.variant_id, detail.quantity]);
             totalQuantity += detail.quantity;
        });
        await Promise.all(detailPromises);

        await client.query('UPDATE inventory_exports SET total_quantity = $1 WHERE id = $2', [totalQuantity, newExportId]);
        await client.query('COMMIT');

        const createdExport = await findExportByIdWithDetails(newExportId, client);
         if (!createdExport) throw new Error("Không thể lấy lại phiếu hủy vừa tạo.");
        return createdExport;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating disposal export:", error);
        throw error;
    } finally {
        client.release();
    }
};


// ===========================================
// == HÀM LẤY DỮ LIỆU CHUNG ==
// ===========================================

/**
 * Lấy danh sách phiếu xuất (type=2 và type=3) kèm tên người/chi nhánh liên quan.
 * Có filter và phân trang.
 */
export const findAllExportsWithNames = async (limit: number, offset: number, filter: ExportFilterOptions) => {
    const { type, status, branchId } = filter;
    const queryParams: any[] = [];
    let whereClauses: string[] = [];

    if (type !== undefined) { queryParams.push(type); whereClauses.push(`ie.type = $${queryParams.length}`); }
    if (status) { queryParams.push(status); whereClauses.push(`ie.status = $${queryParams.length}`); }
    if (branchId !== undefined) {
        // Filter by requesting branch (from) or destination branch (to for type 3)
        queryParams.push(branchId);
        const branchParamIndex = queryParams.length;
         whereClauses.push(`(ie.from_branch_id = $${branchParamIndex} OR (ie.type = 3 AND ie.to_branch_id = $${branchParamIndex}))`);
    }

     const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
        SELECT
            ie.*,
            u_req.name as requested_by_name,
            u_bm.name as branch_manager_name,
            u_wm.name as warehouse_manager_name,
            u_ship.name as shipped_by_name,
            u_rec.name as received_by_name,
            -- Branch names based on correct interpretation
            fb.name as from_branch_name, -- Requesting branch (Type 3) / Source (Type 2 = Kho Tổng)
            CASE WHEN ie.to_branch_id = 0 THEN 'Kho Tổng' ELSE tb.name END as to_branch_name -- Source (Type 3 = Kho Tổng) / Destination (Type 3 if not 0) / NULL (Type 2)
        FROM inventory_exports ie
        LEFT JOIN users u_req ON ie.requested_by = u_req.id
        LEFT JOIN users u_bm ON ie.branch_manager_id = u_bm.id
        LEFT JOIN users u_wm ON ie.warehouse_manager_id = u_wm.id
        LEFT JOIN users u_ship ON ie.shipped_by = u_ship.id
        LEFT JOIN users u_rec ON ie.received_by = u_rec.id
        LEFT JOIN branches fb ON ie.from_branch_id = fb.id
        LEFT JOIN branches tb ON ie.to_branch_id = tb.id -- Join source/destination branch
        ${whereString}
        ORDER BY ie.created_at DESC -- Order by creation/request time
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;

    const countQuery = `SELECT COUNT(*) FROM inventory_exports ie ${whereString}`;

    queryParams.push(limit, offset);

    const [exportsResult, totalResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    // Ensure correct branch name display for source warehouse
     const processedData = exportsResult.rows.map(row => {
         const updatedRow = {
             ...row,
             total_quantity: row.total_quantity ? parseInt(row.total_quantity, 10) : null
         };
         // If type 3, to_branch_name should be 'Kho Tổng'
         if (updatedRow.type === 3 && updatedRow.to_branch_id === 0) {
             updatedRow.to_branch_name = 'Kho Tổng';
         }
         // If type 2, from_branch_name should be 'Kho Tổng'
         if (updatedRow.type === 2 && updatedRow.from_branch_id === 0) {
              updatedRow.from_branch_name = 'Kho Tổng';
         }
         return updatedRow;
     });

    return {
         data: processedData,
        total: parseInt(totalResult.rows[0].count, 10)
    };
};

/**
 * Lấy chi tiết phiếu xuất (type=2 hoặc type=3) theo ID.
 */
export const findExportById = async (id: number) => {
    return findExportByIdWithDetails(id);
};

// Count function with filter
export const countAllExports = async (filter: ExportFilterOptions) => {
     const { type, status, branchId } = filter;
    const queryParams: any[] = [];
    let whereClauses: string[] = [];

    if (type !== undefined) { queryParams.push(type); whereClauses.push(`ie.type = $${queryParams.length}`); }
    if (status) { queryParams.push(status); whereClauses.push(`ie.status = $${queryParams.length}`); }
    if (branchId !== undefined) {
         queryParams.push(branchId);
         whereClauses.push(`(ie.from_branch_id = $${queryParams.length} OR (ie.type = 3 AND ie.to_branch_id = $${queryParams.length}))`);
    }

     const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
     const countQuery = `SELECT COUNT(*) FROM inventory_exports ie ${whereString}`;
    const result = await pool.query(countQuery, queryParams);
    return parseInt(result.rows[0].count, 10);
};
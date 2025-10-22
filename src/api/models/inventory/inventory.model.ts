import pool from '../../../config/db';
import { PoolClient } from 'pg';
import { InventoryImport, InventoryImportDetail, InventoryExport, InventoryExportDetail } from '../../types/inventory/inventory.type';

// ===========================================
// == TYPES & INTERFACES
// ===========================================
type CreateImportInput = Omit<InventoryImport, 'id' | 'created_at' | 'updated_at' | 'total_amount'>;
type CreateImportDetailInput = Omit<InventoryImportDetail, 'id' | 'import_id'>;
type CreateExportInput = Omit<InventoryExport, 'id' | 'created_at' | 'updated_at' | 'total_quantity' | 'from_branch_id'>;
type CreateExportDetailInput = Omit<InventoryExportDetail, 'id' | 'export_id'>;

// ===========================================
// == PHIẾU NHẬP KHO (IMPORTS) ==
// ===========================================
export const findAllImports = async (limit: number, offset: number) => {
    const query = `
        SELECT ii.*, s.name as supplier_name, u.name as created_by_name
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users u ON ii.created_by = u.id
        ORDER BY ii.import_date DESC, ii.id DESC
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
};

export const findImportById = async (id: number) => {
    const importQuery = `
        SELECT ii.*, s.name as supplier_name, u.name as created_by_name
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users u ON ii.created_by = u.id
        WHERE ii.id = $1`;
    const importResult = await pool.query(importQuery, [id]);
    if (importResult.rows.length === 0) return null;
    
    const detailsQuery = `
        SELECT iid.*, p.name as product_name, pv.name as variant_name, pv.sku
        FROM inventory_import_details iid
        JOIN products p ON iid.product_id = p.id
        LEFT JOIN product_variants pv ON iid.variant_id = pv.id
        WHERE iid.import_id = $1`;
    const detailsResult = await pool.query(detailsQuery, [id]);
    return { ...importResult.rows[0], details: detailsResult.rows };
};

export const createImport = async (importData: CreateImportInput, detailsData: CreateImportDetailInput[], createdBy: number): Promise<InventoryImport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { import_code, supplier_id, import_date, status, note } = importData;
        const importResult = await client.query(
            `INSERT INTO inventory_imports (import_code, supplier_id, import_date, status, note, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [import_code, supplier_id, import_date, status, note, createdBy]
        );
        const newImport = importResult.rows[0];
        let totalAmount = 0;
        for (const detail of detailsData) {
            await client.query(
                `INSERT INTO inventory_import_details (import_id, product_id, variant_id, import_quantity, import_price) VALUES ($1, $2, $3, $4, $5)`,
                [newImport.id, detail.product_id, detail.variant_id, detail.import_quantity, detail.import_price]
            );
            if (status === 'completed') {
                await client.query(
                    `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES ($1, $2, $3)
                     ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + $3`,
                    [0, detail.variant_id, detail.import_quantity] // Nhập vào kho tổng (branch_id = 0)
                );
            }
            totalAmount += detail.import_quantity * detail.import_price;
        }
        await client.query('UPDATE inventory_imports SET total_amount = $1 WHERE id = $2', [totalAmount, newImport.id]);
        await client.query('COMMIT');
        newImport.total_amount = totalAmount;
        return newImport;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// ===========================================
// == PHIẾU XUẤT KHO & CHUYỂN KHO (EXPORTS) ==
// ===========================================
export const findAllExports = async (limit: number, offset: number) => {
    const query = `
        SELECT ie.*, u.name as created_by_name, b.name as to_branch_name
        FROM inventory_exports ie
        LEFT JOIN users u ON ie.created_by = u.id
        LEFT JOIN branches b ON ie.to_branch_id = b.id
        ORDER BY ie.export_date DESC, ie.id DESC
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
};

export const findExportById = async (id: number) => {
    const exportQuery = `
        SELECT ie.*, u.name as created_by_name, b.name as to_branch_name
        FROM inventory_exports ie
        LEFT JOIN users u ON ie.created_by = u.id
        LEFT JOIN branches b ON ie.to_branch_id = b.id
        WHERE ie.id = $1`;
    const exportResult = await pool.query(exportQuery, [id]);
    if (exportResult.rows.length === 0) return null;
    const detailsQuery = `
        SELECT ied.*, p.name as product_name, pv.name as variant_name, pv.sku
        FROM inventory_export_details ied
        JOIN products p ON ied.product_id = p.id
        LEFT JOIN product_variants pv ON ied.variant_id = pv.id
        WHERE ied.export_id = $1`;
    const detailsResult = await pool.query(detailsQuery, [id]);
    return { ...exportResult.rows[0], details: detailsResult.rows };
};

export const createExport = async (exportData: CreateExportInput, detailsData: CreateExportDetailInput[], createdBy: number): Promise<InventoryExport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { export_code, type, reference_id, to_branch_id, export_date, notes } = exportData as any;
        const from_branch_id = 0; // Quy ước: Luôn xuất từ kho tổng
        const status = (type === 3) ? 'pending' : 'completed';

        const exportResult = await client.query(
            `INSERT INTO inventory_exports (export_code, type, reference_id, to_branch_id, export_date, notes, created_by, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [export_code, type, reference_id, to_branch_id, export_date, notes, createdBy, status]
        );
        const newExport = exportResult.rows[0];
        let totalQuantity = 0;

        for (const detail of detailsData) {
            const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2 FOR UPDATE', [from_branch_id, detail.variant_id]);
            if (stockCheck.rows.length === 0 || stockCheck.rows[0].quantity < detail.quantity) {
                throw new Error(`Sản phẩm (variant_id: ${detail.variant_id}) không đủ tồn kho tại kho tổng.`);
            }
            await client.query(`UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = $2 AND variant_id = $3`, [detail.quantity, from_branch_id, detail.variant_id]);
            await client.query(`INSERT INTO inventory_export_details (export_id, product_id, variant_id, quantity) VALUES ($1, $2, $3, $4)`, [newExport.id, detail.product_id, detail.variant_id, detail.quantity]);
            totalQuantity += detail.quantity;
        }

        await client.query('UPDATE inventory_exports SET total_quantity = $1 WHERE id = $2', [totalQuantity, newExport.id]);
        await client.query('COMMIT');
        newExport.total_quantity = totalQuantity;
        return newExport;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const cancelExport = async (exportId: number, reason: string, userId: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const exportResult = await client.query('SELECT * FROM inventory_exports WHERE id = $1 FOR UPDATE', [exportId]);
        if (exportResult.rows.length === 0) throw new Error('Không tìm thấy phiếu xuất.');
        const currentExport = exportResult.rows[0];
        if (currentExport.status === 'cancelled' || currentExport.status === 'in_transit' || currentExport.status === 'received') {
            throw new Error('Không thể hủy phiếu ở trạng thái này.');
        }

        await client.query(
            'UPDATE inventory_exports SET status = $1, notes = CONCAT(COALESCE(notes, \'\'), $2) WHERE id = $3',
            ['cancelled', `\nCancelled by user ${userId}: ${reason}`, exportId]
        );
        
        const details = await client.query('SELECT * FROM inventory_export_details WHERE export_id = $1', [exportId]);
        const from_branch_id = 0; // Quy ước: Luôn hoàn trả về kho tổng
        for (const detail of details.rows) {
            await client.query(
                `UPDATE branch_inventories SET quantity = quantity + $1 WHERE branch_id = $2 AND variant_id = $3`,
                [detail.quantity, from_branch_id, detail.variant_id]
            );
        }
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// ===========================================
// == KIỂM KHO (CHECKS) ==
// ===========================================
export const getInventoryByBranch = async (branchId: number) => {
    const result = await pool.query(
        `SELECT bi.variant_id, bi.quantity, pv.name as variant_name, pv.sku, p.name as product_name
         FROM branch_inventories bi
         JOIN product_variants pv ON bi.variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE bi.branch_id = $1`,
        [branchId]
    );
    return result.rows;
};

export const findAllChecks = async (limit: number, offset: number) => {
    const checksQuery = pool.query(
        `SELECT ic.id, ic.status, ic.notes, ic.check_date, b.name as branch_name, u.name as user_name
         FROM inventory_checks ic
         JOIN branches b ON ic.branch_id = b.id
         JOIN users u ON ic.user_id = u.id
         ORDER BY ic.check_date DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    const totalQuery = pool.query('SELECT COUNT(*) FROM inventory_checks');
    const [checksResult, totalResult] = await Promise.all([checksQuery, totalQuery]);
    return { checks: checksResult.rows, total: parseInt(totalResult.rows[0].count, 10) };
};

export const findCheckById = async (checkId: number) => {
    const checkPromise = pool.query(
        `SELECT ic.*, b.name as branch_name, u.name as user_name
         FROM inventory_checks ic
         JOIN branches b ON ic.branch_id = b.id
         JOIN users u ON ic.user_id = u.id
         WHERE ic.id = $1`,
        [checkId]
    );
    const itemsPromise = pool.query(
        `SELECT ici.*, pv.name as variant_name, pv.sku
         FROM inventory_check_items ici
         JOIN product_variants pv ON ici.variant_id = pv.id
         WHERE ici.inventory_check_id = $1 ORDER BY pv.name ASC`,
        [checkId]
    );
    const [checkResult, itemsResult] = await Promise.all([checkPromise, itemsPromise]);
    if (checkResult.rows.length === 0) return null;
    return { ...checkResult.rows[0], items: itemsResult.rows };
};

export const createCheck = async (branchId: number, userId: number, notes?: string) => {
    const result = await pool.query(
        'INSERT INTO inventory_checks (branch_id, user_id, notes) VALUES ($1, $2, $3) RETURNING *',
        [branchId, userId, notes]
    );
    return result.rows[0];
};

export const addCheckItem = async (checkId: number, variantId: number, countedQuantity: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query("SELECT branch_id, status FROM inventory_checks WHERE id = $1 FOR UPDATE", [checkId]);
        if (check.rows.length === 0) throw new Error('Không tìm thấy phiếu kiểm kho.');
        if (check.rows[0].status !== 'pending') throw new Error('Không thể thêm sản phẩm vào phiếu đã hoàn thành.');
        const inventory = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2', [check.rows[0].branch_id, variantId]);
        const previousQuantity = inventory.rows[0]?.quantity || 0;
        const adjustment = countedQuantity - previousQuantity;
        const result = await client.query(
            `INSERT INTO inventory_check_items (inventory_check_id, variant_id, previous_quantity, counted_quantity, adjustment) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [checkId, variantId, previousQuantity, countedQuantity, adjustment]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const updateCheckItem = async (checkId: number, itemId: number, countedQuantity: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query("SELECT status FROM inventory_checks WHERE id = $1 FOR UPDATE", [checkId]);
        if (check.rows[0]?.status !== 'pending') throw new Error('Không thể sửa phiếu đã hoàn thành.');
        const item = await client.query("SELECT previous_quantity FROM inventory_check_items WHERE id = $1 AND inventory_check_id = $2", [itemId, checkId]);
        if (item.rows.length === 0) return null;
        const adjustment = countedQuantity - item.rows[0].previous_quantity;
        const result = await client.query(
            "UPDATE inventory_check_items SET counted_quantity = $1, adjustment = $2 WHERE id = $3 RETURNING *",
            [countedQuantity, adjustment, itemId]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const removeCheckItem = async (checkId: number, itemId: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query("SELECT status FROM inventory_checks WHERE id = $1 FOR UPDATE", [checkId]);
        if (check.rows[0]?.status !== 'pending') throw new Error('Không thể xóa sản phẩm khỏi phiếu đã hoàn thành.');
        const result = await client.query("DELETE FROM inventory_check_items WHERE id = $1 AND inventory_check_id = $2", [itemId, checkId]);
        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const deleteCheck = async (checkId: number): Promise<boolean> => {
    const result = await pool.query("DELETE FROM inventory_checks WHERE id = $1 AND status = 'pending'", [checkId]);
    return (result.rowCount ?? 0) > 0;
};

export const finalizeCheck = async (checkId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query('SELECT branch_id, status FROM inventory_checks WHERE id = $1 FOR UPDATE', [checkId]);
        if (check.rows.length === 0) throw new Error('Không tìm thấy phiếu kiểm kho.');
        if (check.rows[0].status === 'completed') throw new Error('Phiếu đã được hoàn thành trước đó.');
        const branchId = check.rows[0].branch_id;
        const items = await client.query('SELECT variant_id, counted_quantity FROM inventory_check_items WHERE inventory_check_id = $1', [checkId]);
        for (const item of items.rows) {
            await client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES ($1, $2, $3)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
                [branchId, item.variant_id, item.counted_quantity]
            );
        }
        await client.query("UPDATE inventory_checks SET status = 'completed' WHERE id = $1", [checkId]);
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
/**
 * BƯỚC 1: Nhân viên kho tạo một yêu cầu nhập hàng.
 */
export const requestImport = async (importData: any, detailsData: any[], requestedBy: number): Promise<InventoryImport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { import_code, note } = importData;
        
        const importResult = await client.query(
            `INSERT INTO inventory_imports (import_code, note, status, requested_by, requested_at) 
             VALUES ($1, $2, 'requested', $3, NOW()) RETURNING *`,
            [import_code, note, requestedBy]
        );
        const newImport = importResult.rows[0];

        for (const detail of detailsData) {
            if (!detail.variant_id) throw new Error('Mỗi sản phẩm phải có variant_id.');
            await client.query(
                `INSERT INTO inventory_import_details (import_id, product_id, variant_id, import_quantity, import_price) 
                 VALUES ($1, $2, $3, $4, 0)`, // Giá tạm thời là 0
                [newImport.id, detail.product_id, detail.variant_id, detail.import_quantity]
            );
        }

        await client.query('COMMIT');
        return newImport;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 2: Quản lý phê duyệt hoặc hủy yêu cầu.
 */
export const approveOrCancelImport = async (importId: number, action: 'approve' | 'cancel', data: any, approvedBy: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query("SELECT status FROM inventory_imports WHERE id = $1 FOR UPDATE", [importId]);
        if (current.rows.length === 0) throw new Error('Không tìm thấy phiếu yêu cầu.');
        if (current.rows[0].status !== 'requested') throw new Error('Chỉ có thể duyệt/hủy các phiếu đang ở trạng thái "Yêu cầu".');
        
        if (action === 'cancel') {
            const { note } = data;
            await client.query("UPDATE inventory_imports SET status = 'cancelled', notes = CONCAT(notes, '\nCancelled: ', $2) WHERE id = $1", [importId, note]);
            await client.query('COMMIT');
            return { success: true, message: 'Đã hủy phiếu yêu cầu.' };
        }

        // Nếu là 'approve'
        const { supplier_id, details } = data;
        if (!supplier_id || !details) throw new Error('Cần cung cấp nhà cung cấp và chi tiết giá sản phẩm.');
        
        let totalAmount = 0;
        for (const detail of details) {
            await client.query(
                "UPDATE inventory_import_details SET import_price = $1 WHERE id = $2 AND import_id = $3",
                [detail.import_price, detail.id, importId]
            );
            totalAmount += detail.import_quantity * detail.import_price;
        }

        await client.query(
            "UPDATE inventory_imports SET status = 'approved', supplier_id = $1, approved_by = $2, approved_at = NOW(), total_amount = $3 WHERE id = $4",
            [supplier_id, approvedBy, totalAmount, importId]
        );

        await client.query('COMMIT');
        return { success: true, message: 'Đã phê duyệt phiếu nhập kho.' };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 3: Kế toán xác nhận thanh toán.
 */
export const markAsPaid = async (importId: number) => {
    // Sửa lỗi: Sử dụng 'pool.query' trực tiếp vì 'client' không được định nghĩa ở đây.
    const result = await pool.query(
        "UPDATE inventory_imports SET payment_status = 'paid' WHERE id = $1 AND status = 'approved' RETURNING id", 
        [importId]
    );
    return (result.rowCount ?? 0) > 0;
};
/**
 * BƯỚC 4: Nhân viên kho xác nhận nhận hàng và CỘNG TỒN KHO.
 */
export const receiveImport = async (importId: number, receivedBy: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query("SELECT status FROM inventory_imports WHERE id = $1 FOR UPDATE", [importId]);
        if (current.rows.length === 0) throw new Error('Không tìm thấy phiếu nhập kho.');
        if (current.rows[0].status !== 'approved' && current.rows[0].status !== 'paid') throw new Error('Chỉ có thể nhận hàng cho các phiếu đã được phê duyệt.');
        
        const details = await client.query("SELECT variant_id, import_quantity FROM inventory_import_details WHERE import_id = $1", [importId]);

        for (const detail of details.rows) {
            await client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES (0, $1, $2)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + $2`,
                [detail.variant_id, detail.import_quantity]
            );
        }

        await client.query("UPDATE inventory_imports SET status = 'completed', received_by = $1, received_at = NOW() WHERE id = $2", [receivedBy, importId]);
        
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
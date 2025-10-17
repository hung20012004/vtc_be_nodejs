import pool from '../../config/db';
import { PoolClient } from 'pg';
import { InventoryImport, InventoryImportDetail, InventoryExport, InventoryExportDetail } from '../types/inventory.type';

// ===========================================
// == TYPES & INTERFACES
// ===========================================
type CreateImportInput = Omit<InventoryImport, 'id' | 'created_at' | 'updated_at' | 'total_amount'>;
type CreateImportDetailInput = Omit<InventoryImportDetail, 'id' | 'import_id'>;
type CreateExportInput = Omit<InventoryExport, 'id' | 'created_at' | 'updated_at' | 'total_quantity'>;
type CreateExportDetailInput = Omit<InventoryExportDetail, 'id' | 'export_id'>;

// ===========================================
// == PHIẾU NHẬP KHO (IMPORTS) ==
// ===========================================
export const findAllImports = async (limit: number, offset: number): Promise<InventoryImport[]> => {
    const result = await pool.query('SELECT * FROM inventory_imports ORDER BY import_date DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return result.rows;
};

export const findImportById = async (id: number) => {
    const importResult = await pool.query('SELECT * FROM inventory_imports WHERE id = $1', [id]);
    if (importResult.rows.length === 0) return null;
    const detailsResult = await pool.query('SELECT * FROM inventory_import_details WHERE import_id = $1', [id]);
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
            await client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES ($1, $2, $3)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + $3`,
                [0, detail.variant_id, detail.import_quantity] // Mặc định nhập vào kho tổng (branch_id = 0)
            );
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
// == PHIẾU XUẤT KHO (EXPORTS) ==
// ===========================================
export const findAllExports = async (limit: number, offset: number): Promise<InventoryExport[]> => {
    const result = await pool.query('SELECT * FROM inventory_exports ORDER BY export_date DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return result.rows;
};

export const findExportById = async (id: number) => {
    const exportResult = await pool.query('SELECT * FROM inventory_exports WHERE id = $1', [id]);
    if (exportResult.rows.length === 0) return null;
    const detailsResult = await pool.query('SELECT * FROM inventory_export_details WHERE export_id = $1', [id]);
    return { ...exportResult.rows[0], details: detailsResult.rows };
};

export const createExport = async (exportData: CreateExportInput, detailsData: CreateExportDetailInput[], createdBy: number): Promise<InventoryExport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { export_code, type, reference_id, export_date, notes } = exportData;
        const exportResult = await client.query(
            `INSERT INTO inventory_exports (export_code, type, reference_id, export_date, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [export_code, type, reference_id, export_date, notes, createdBy]
        );
        const newExport = exportResult.rows[0];
        let totalQuantity = 0;
        for (const detail of detailsData) {
            await client.query(
                `INSERT INTO inventory_export_details (export_id, product_id, variant_id, quantity) VALUES ($1, $2, $3, $4)`,
                [newExport.id, detail.product_id, detail.variant_id, detail.quantity]
            );
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
        if (exportResult.rows[0].status === 'cancelled') throw new Error('Phiếu xuất đã được hủy trước đó.');

        await client.query(
            'UPDATE inventory_exports SET status = $1, notes = CONCAT(notes, $2) WHERE id = $3',
            ['cancelled', `\nCancelled: ${reason}`, exportId]
        );
        const details = await client.query('SELECT * FROM inventory_export_details WHERE export_id = $1', [exportId]);
        for (const detail of details.rows) {
            await client.query(
                `UPDATE branch_inventories SET quantity = quantity + $1 WHERE branch_id = 0 AND variant_id = $2`,
                [detail.quantity, detail.variant_id]
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
// == TỒN KHO & KIỂM KHO (STOCKS & CHECKS) ==
// ===========================================
export const getInventoryByBranch = async (branchId: number) => {
    const result = await pool.query(
        `SELECT bi.*, pv.name as variant_name, pv.sku, p.name as product_name
         FROM branch_inventories bi
         JOIN product_variants pv ON bi.variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE bi.branch_id = $1`,
        [branchId]
    );
    return result.rows;
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
        const check = await client.query('SELECT branch_id FROM inventory_checks WHERE id = $1', [checkId]);
        if (check.rows.length === 0) throw new Error('Không tìm thấy phiếu kiểm kho.');

        const inventory = await client.query(
            'SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2',
            [check.rows[0].branch_id, variantId]
        );
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
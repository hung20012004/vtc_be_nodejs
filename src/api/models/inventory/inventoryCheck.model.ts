import pool from '../../../config/db';
import { PoolClient } from 'pg';
import { InventoryCheck, InventoryCheckItem } from '../../types/inventory/inventory.type'; // Đảm bảo import đúng type

// ===========================================
// == KIỂM KHO (CHECKS) ==
// ===========================================

/**
 * Lấy danh sách phiếu kiểm kho (phân trang)
 */
export const findAllChecks = async (limit: number, offset: number) => {
    const checksQuery = pool.query(
        `SELECT ic.id, ic.status, ic.notes, ic.check_date, b.name as branch_name, u.name as user_name
         FROM inventory_checks ic
         JOIN branches b ON ic.branch_id = b.id
         JOIN users u ON ic.user_id = u.id
         ORDER BY ic.check_date DESC, ic.id DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    const totalQuery = pool.query('SELECT COUNT(*) FROM inventory_checks');
    const [checksResult, totalResult] = await Promise.all([checksQuery, totalQuery]);
    return { checks: checksResult.rows, total: parseInt(totalResult.rows[0].count, 10) };
};

/**
 * Tìm chi tiết phiếu kiểm kho theo ID
 */
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
        `SELECT ici.*, pv.name as variant_name, pv.sku, p.name as product_name
         FROM inventory_check_items ici
         JOIN product_variants pv ON ici.variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE ici.inventory_check_id = $1 ORDER BY p.name ASC, pv.name ASC`,
        [checkId]
    );
    const [checkResult, itemsResult] = await Promise.all([checkPromise, itemsPromise]);
    if (checkResult.rows.length === 0) return null;

    // Chuyển đổi số lượng sang number
    const items = itemsResult.rows.map(item => ({
        ...item,
        previous_quantity: parseInt(item.previous_quantity, 10),
        counted_quantity: parseInt(item.counted_quantity, 10),
        adjustment: parseInt(item.adjustment, 10),
    }));

    return { ...checkResult.rows[0], items: items };
};

/**
 * Tạo một phiếu kiểm kho mới (status: 'pending')
 */
export const createCheck = async (branchId: number, userId: number, notes?: string): Promise<InventoryCheck> => {
    const checkDate = new Date(); // Ngày kiểm kho là ngày tạo phiếu
    const result = await pool.query(
        "INSERT INTO inventory_checks (branch_id, user_id, notes, check_date, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *",
        [branchId, userId, notes, checkDate]
    );
    return result.rows[0];
};

/**
 * Thêm một sản phẩm vào phiếu kiểm kho đang chờ xử lý.
 * Tự động lấy tồn kho hệ thống (previous_quantity).
 */
export const addCheckItem = async (checkId: number, variantId: number, countedQuantity: number): Promise<InventoryCheckItem> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Kiểm tra phiếu kiểm kho và lấy branch_id
        const checkResult = await client.query("SELECT branch_id, status FROM inventory_checks WHERE id = $1 FOR UPDATE", [checkId]);
        if (checkResult.rows.length === 0) throw new Error('Không tìm thấy phiếu kiểm kho.');
        if (checkResult.rows[0].status !== 'pending') throw new Error('Không thể thêm sản phẩm vào phiếu đã hoàn thành hoặc hủy.');
        const branchId = checkResult.rows[0].branch_id;

        // Kiểm tra xem item đã tồn tại trong phiếu chưa
        const existingItem = await client.query("SELECT id FROM inventory_check_items WHERE inventory_check_id = $1 AND variant_id = $2", [checkId, variantId]);
        if (existingItem.rows.length > 0) {
             throw new Error(`Sản phẩm (variant_id: ${variantId}) đã tồn tại trong phiếu kiểm kho này.`);
        }

        // Lấy tồn kho hiện tại trên hệ thống
        const inventoryResult = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2', [branchId, variantId]);
        const previousQuantity = inventoryResult.rows[0]?.quantity || 0;
        const adjustment = countedQuantity - previousQuantity; // Tính chênh lệch

        // Thêm item vào chi tiết phiếu kiểm
        const result = await client.query(
            `INSERT INTO inventory_check_items (inventory_check_id, variant_id, previous_quantity, counted_quantity, adjustment)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [checkId, variantId, previousQuantity, countedQuantity, adjustment]
        );
        await client.query('COMMIT');
        // Chuyển đổi số lượng sang number trước khi trả về
        const newItem = result.rows[0];
        return {
             ...newItem,
             previous_quantity: parseInt(newItem.previous_quantity, 10),
             counted_quantity: parseInt(newItem.counted_quantity, 10),
             adjustment: parseInt(newItem.adjustment, 10),
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in addCheckItem:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Cập nhật số lượng đếm được cho một sản phẩm trong phiếu kiểm kho.
 */
export const updateCheckItem = async (checkId: number, itemId: number, countedQuantity: number): Promise<InventoryCheckItem | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Kiểm tra trạng thái phiếu
        const checkResult = await client.query("SELECT status FROM inventory_checks WHERE id = $1 FOR UPDATE", [checkId]);
        if (checkResult.rows[0]?.status !== 'pending') throw new Error('Không thể sửa sản phẩm trong phiếu đã hoàn thành hoặc hủy.');

        // Lấy previous_quantity của item
        const itemResult = await client.query("SELECT previous_quantity FROM inventory_check_items WHERE id = $1 AND inventory_check_id = $2 FOR UPDATE", [itemId, checkId]);
        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK'); // Không tìm thấy item
            return null;
        }
        const previousQuantity = itemResult.rows[0].previous_quantity;
        const adjustment = countedQuantity - previousQuantity; // Tính lại chênh lệch

        // Cập nhật item
        const result = await client.query(
            "UPDATE inventory_check_items SET counted_quantity = $1, adjustment = $2 WHERE id = $3 RETURNING *",
            [countedQuantity, adjustment, itemId]
        );
        await client.query('COMMIT');

        const updatedItem = result.rows[0];
         return {
             ...updatedItem,
             previous_quantity: parseInt(updatedItem.previous_quantity, 10),
             counted_quantity: parseInt(updatedItem.counted_quantity, 10),
             adjustment: parseInt(updatedItem.adjustment, 10),
         };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in updateCheckItem:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Xóa một sản phẩm khỏi phiếu kiểm kho đang chờ xử lý.
 */
export const removeCheckItem = async (checkId: number, itemId: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Kiểm tra trạng thái phiếu
        const checkResult = await client.query("SELECT status FROM inventory_checks WHERE id = $1 FOR UPDATE", [checkId]);
        if (checkResult.rows[0]?.status !== 'pending') throw new Error('Không thể xóa sản phẩm khỏi phiếu đã hoàn thành hoặc hủy.');

        // Xóa item
        const result = await client.query("DELETE FROM inventory_check_items WHERE id = $1 AND inventory_check_id = $2", [itemId, checkId]);
        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in removeCheckItem:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Xóa một phiếu kiểm kho đang ở trạng thái chờ ('pending').
 */
export const deleteCheck = async (checkId: number): Promise<boolean> => {
    // Chỉ xóa phiếu khi đang là pending, không cần transaction phức tạp
    const result = await pool.query("DELETE FROM inventory_checks WHERE id = $1 AND status = 'pending'", [checkId]);
    return (result.rowCount ?? 0) > 0;
};

/**
 * Hoàn thành phiếu kiểm kho: Cập nhật tồn kho thực tế trong branch_inventories.
 */
export const finalizeCheck = async (checkId: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Kiểm tra phiếu và lấy branch_id, khóa dòng
        const checkResult = await client.query('SELECT branch_id, status FROM inventory_checks WHERE id = $1 FOR UPDATE', [checkId]);
        if (checkResult.rows.length === 0) throw new Error('Không tìm thấy phiếu kiểm kho.');
        if (checkResult.rows[0].status !== 'pending') throw new Error('Phiếu kiểm kho đã được hoàn thành hoặc hủy trước đó.');
        const branchId = checkResult.rows[0].branch_id;

        // Lấy danh sách items trong phiếu kiểm
        const itemsResult = await client.query('SELECT variant_id, counted_quantity FROM inventory_check_items WHERE inventory_check_id = $1', [checkId]);
        if (itemsResult.rows.length === 0) {
            // Nếu không có item nào, vẫn hoàn thành phiếu nhưng không cập nhật kho
             console.warn(`Phiếu kiểm kho ${checkId} không có sản phẩm nào.`);
        } else {
             // Cập nhật tồn kho thực tế cho từng sản phẩm
             const inventoryUpdatePromises = itemsResult.rows.map(item =>
                 client.query(
                     `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES ($1, $2, $3)
                      ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
                     [branchId, item.variant_id, item.counted_quantity] // Ghi đè số lượng cũ bằng số lượng đếm được
                 )
             );
             await Promise.all(inventoryUpdatePromises);
        }


        // Cập nhật trạng thái phiếu kiểm kho thành 'completed'
        await client.query("UPDATE inventory_checks SET status = 'completed', updated_at = NOW() WHERE id = $1", [checkId]);
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in finalizeCheck:", error);
        throw error;
    } finally {
        client.release();
    }
};
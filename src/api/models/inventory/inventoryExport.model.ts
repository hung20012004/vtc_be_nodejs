import pool from '../../../config/db';
import { PoolClient } from 'pg';
import { InventoryExport, InventoryExportDetail } from '../../types/inventory/inventory.type'; // Đảm bảo import đúng type

type CreateExportInput = Omit<InventoryExport, 'id' | 'created_at' | 'updated_at' | 'total_quantity' | 'from_branch_id' | 'status'>;
type CreateExportDetailInput = Omit<InventoryExportDetail, 'id' | 'export_id'>;

// ===========================================
// == PHIẾU XUẤT KHO & CHUYỂN KHO (EXPORTS) ==
// ===========================================

/**
 * Lấy danh sách phiếu xuất/chuyển kho (phân trang)
 */
export const findAllExports = async (limit: number, offset: number) => {
    const query = `
        SELECT ie.*, u.name as created_by_name,
               fb.name as from_branch_name, -- Lấy tên kho xuất (luôn là Kho tổng?)
               tb.name as to_branch_name    -- Lấy tên kho nhận (nếu là chuyển kho)
        FROM inventory_exports ie
        LEFT JOIN users u ON ie.created_by = u.id
        LEFT JOIN branches fb ON ie.from_branch_id = fb.id -- Join kho xuất
        LEFT JOIN branches tb ON ie.to_branch_id = tb.id   -- Join kho nhận
        ORDER BY ie.export_date DESC NULLS LAST, ie.id DESC
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    // Chuyển đổi total_quantity sang number
    return result.rows.map(row => ({
        ...row,
        total_quantity: row.total_quantity ? parseInt(row.total_quantity, 10) : null
    }));
};

/**
 * Lấy tổng số phiếu xuất/chuyển kho (để phân trang)
 */
export const countAllExports = async () => {
    const result = await pool.query('SELECT COUNT(*) FROM inventory_exports');
    return parseInt(result.rows[0].count, 10);
};

/**
 * Tìm chi tiết phiếu xuất/chuyển kho theo ID
 */
export const findExportById = async (id: number) => {
    const exportQuery = `
        SELECT ie.*, u.name as created_by_name,
               fb.name as from_branch_name,
               tb.name as to_branch_name
        FROM inventory_exports ie
        LEFT JOIN users u ON ie.created_by = u.id
        LEFT JOIN branches fb ON ie.from_branch_id = fb.id
        LEFT JOIN branches tb ON ie.to_branch_id = tb.id
        WHERE ie.id = $1`;
    const exportResult = await pool.query(exportQuery, [id]);
    if (exportResult.rows.length === 0) return null;

    const detailsQuery = `
        SELECT ied.*,
               p.name as product_name, p.images->>'thumbnail' as product_image,
               pv.name as variant_name, pv.sku, pv.image as variant_image
        FROM inventory_export_details ied
        JOIN product_variants pv ON ied.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ied.export_id = $1 ORDER BY p.name, pv.name`;
    const detailsResult = await pool.query(detailsQuery, [id]);

    // Chuyển đổi quantity sang number
    const details = detailsResult.rows.map(d => ({
        ...d,
        quantity: parseInt(d.quantity, 10)
    }));

    return {
        ...exportResult.rows[0],
        total_quantity: exportResult.rows[0].total_quantity ? parseInt(exportResult.rows[0].total_quantity, 10) : null,
        details: details
    };
};

/**
 * Tạo phiếu xuất kho (vd: Hủy hàng) hoặc chuyển kho.
 * Luôn xuất từ kho tổng (branch_id = 0).
 */
export const createExport = async (exportData: CreateExportInput, detailsData: CreateExportDetailInput[], createdBy: number): Promise<InventoryExport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { export_code, type, reference_id, to_branch_id, export_date, notes } = exportData;
        const from_branch_id = 0; // Quy ước: Luôn xuất từ kho tổng

        // Xác định trạng thái ban đầu dựa vào loại phiếu xuất
        // Type 1 (Bán hàng) - Không tạo qua đây, tạo tự động khi đơn hàng được xử lý
        // Type 2 (Hủy hàng) -> completed ngay
        // Type 3 (Chuyển kho) -> in_transit (hoặc pending tùy quy trình)
        let initialStatus: InventoryExport['status'];
        if (type === 2) {
            initialStatus = 'completed';
        } else if (type === 3) {
            initialStatus = 'in_transit'; // Giả sử chuyển đi là đang vận chuyển luôn
            if (!to_branch_id) throw new Error('Phiếu chuyển kho phải có chi nhánh đích (to_branch_id).');
        } else {
            throw new Error(`Loại phiếu xuất (${type}) không hợp lệ hoặc không được hỗ trợ tạo thủ công.`);
        }

        const finalExportCode = export_code || `EXP-${Date.now()}`;
        const finalExportDate = export_date || new Date(); // Mặc định là ngày hiện tại

        // Tạo phiếu xuất chính
        const exportResult = await client.query(
            `INSERT INTO inventory_exports (export_code, type, reference_id, from_branch_id, to_branch_id, export_date, notes, created_by, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [finalExportCode, type, reference_id, from_branch_id, to_branch_id, finalExportDate, notes, createdBy, initialStatus]
        );
        const newExport = exportResult.rows[0];
        let totalQuantity = 0;

        // Xử lý chi tiết và trừ kho tổng
        const detailPromises = detailsData.map(async (detail) => {
             if (!detail.variant_id || !detail.quantity || detail.quantity <= 0) {
                 throw new Error('Mỗi sản phẩm xuất/chuyển phải có variant_id và số lượng hợp lệ (> 0).');
             }
             // Kiểm tra tồn kho tại kho tổng và khóa dòng
             const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = $1 AND variant_id = $2 FOR UPDATE', [from_branch_id, detail.variant_id]);
             const currentStock = stockCheck.rows[0]?.quantity || 0;
             if (currentStock < detail.quantity) {
                 throw new Error(`Sản phẩm (variant_id: ${detail.variant_id}) không đủ tồn kho tại kho tổng (cần ${detail.quantity}, còn ${currentStock}).`);
             }
             // Trừ kho tổng
             await client.query(`UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = $2 AND variant_id = $3`, [detail.quantity, from_branch_id, detail.variant_id]);
             // Thêm chi tiết phiếu xuất
             await client.query(`INSERT INTO inventory_export_details (export_id, product_id, variant_id, quantity) VALUES ($1, $2, $3, $4)`, [newExport.id, detail.product_id, detail.variant_id, detail.quantity]);

             totalQuantity += detail.quantity;
        });
        await Promise.all(detailPromises);

        // Cập nhật tổng số lượng vào phiếu chính
        await client.query('UPDATE inventory_exports SET total_quantity = $1 WHERE id = $2', [totalQuantity, newExport.id]);
        await client.query('COMMIT');

        newExport.total_quantity = totalQuantity; // Gán lại để trả về
        return newExport;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in createExport:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Hủy một phiếu xuất/chuyển kho (chỉ khi chưa hoàn thành hoặc chưa nhận).
 * Hoàn trả số lượng về kho tổng.
 */
export const cancelExport = async (exportId: number, reason: string, userId: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const exportResult = await client.query('SELECT * FROM inventory_exports WHERE id = $1 FOR UPDATE', [exportId]);
        if (exportResult.rows.length === 0) throw new Error('Không tìm thấy phiếu xuất.');

        const currentExport = exportResult.rows[0];
        // Chỉ cho hủy khi đang chờ xử lý hoặc đang vận chuyển (tùy nghiệp vụ)
        if (currentExport.status === 'completed' || currentExport.status === 'received' || currentExport.status === 'cancelled') {
            throw new Error(`Không thể hủy phiếu xuất đang ở trạng thái "${currentExport.status}".`);
        }

        // Cập nhật trạng thái phiếu thành 'cancelled' và thêm ghi chú
        const finalNote = `Cancelled by User ${userId}: ${reason}`;
        await client.query(
            `UPDATE inventory_exports SET status = 'cancelled', notes = CONCAT(COALESCE(notes,''), E'\\n', $2), updated_at = NOW() WHERE id = $1`,
            [exportId, finalNote]
        );

        // Hoàn trả số lượng về kho tổng (branch_id = 0)
        const detailsResult = await client.query('SELECT variant_id, quantity FROM inventory_export_details WHERE export_id = $1', [exportId]);
        const inventoryRevertPromises = detailsResult.rows.map(detail =>
            client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES (0, $1, $2)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + EXCLUDED.quantity`,
                [detail.variant_id, detail.quantity]
            )
        );
        await Promise.all(inventoryRevertPromises);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in cancelExport:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * [HÀM MỚI] Xác nhận đã nhận hàng chuyển kho tại chi nhánh đích.
 * Cộng tồn kho cho chi nhánh đích.
 */
export const receiveTransfer = async (exportId: number, receivedBy: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const exportResult = await client.query('SELECT * FROM inventory_exports WHERE id = $1 AND type = 3 FOR UPDATE', [exportId]); // Chỉ áp dụng cho type = 3 (Chuyển kho)
        if (exportResult.rows.length === 0) throw new Error('Không tìm thấy phiếu chuyển kho hoặc phiếu không hợp lệ.');

        const currentExport = exportResult.rows[0];
        if (currentExport.status !== 'in_transit') { // Chỉ nhận hàng khi đang vận chuyển
             throw new Error(`Không thể nhận hàng cho phiếu chuyển kho đang ở trạng thái "${currentExport.status}".`);
        }
        if (!currentExport.to_branch_id) {
             throw new Error('Phiếu chuyển kho không có chi nhánh đích.');
        }
        const toBranchId = currentExport.to_branch_id;

        // Cập nhật trạng thái phiếu thành 'received'
        await client.query(
            `UPDATE inventory_exports SET status = 'received', notes = CONCAT(COALESCE(notes,''), E'\\nReceived by User ${receivedBy} at branch ${toBranchId}'), updated_at = NOW() WHERE id = $1`,
            [exportId]
        );

        // Cộng tồn kho cho chi nhánh đích
        const detailsResult = await client.query('SELECT variant_id, quantity FROM inventory_export_details WHERE export_id = $1', [exportId]);
        const inventoryReceivePromises = detailsResult.rows.map(detail =>
            client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES ($1, $2, $3)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + EXCLUDED.quantity`,
                [toBranchId, detail.variant_id, detail.quantity]
            )
        );
        await Promise.all(inventoryReceivePromises);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in receiveTransfer:", error);
        throw error;
    } finally {
        client.release();
    }
};
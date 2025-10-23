import pool from '../../../config/db'; // Đảm bảo đường dẫn đúng
import { PoolClient } from 'pg';
import { InventoryImport, InventoryImportDetail } from '../../types/inventory/inventory.type'; // Đảm bảo import đúng type

type CreateImportInput = Omit<InventoryImport, 'id' | 'created_at' | 'updated_at' | 'total_amount' | 'status' | 'payment_status' | 'import_date' | 'approved_by' | 'approved_at' | 'received_by' | 'received_at' | 'supplier_id' | 'paid_by'>; // Thêm paid_by vào Omit nếu có
type CreateImportDetailInput = Omit<InventoryImportDetail, 'id' | 'import_id' | 'import_price'> & { import_price?: number };

// ===========================================
// == PHIẾU NHẬP KHO (IMPORTS) ==
// ===========================================

/**
 * Lấy danh sách phiếu nhập kho (phân trang) - [CẬP NHẬT] Thêm tên người thanh toán
 */
export const findAllImports = async (limit: number, offset: number) => {
    const query = `
        SELECT
            ii.*, s.name as supplier_name,
            req_u.name as requested_by_name,
            app_u.name as approved_by_name,
            rec_u.name as received_by_name,
            pay_u.name as paid_by_name -- <<--- THÊM TÊN NGƯỜI THANH TOÁN
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users req_u ON ii.requested_by = req_u.id
        LEFT JOIN users app_u ON ii.approved_by = app_u.id
        LEFT JOIN users rec_u ON ii.received_by = rec_u.id
        LEFT JOIN users pay_u ON ii.paid_by = pay_u.id -- <<--- JOIN THÊM BẢNG USERS CHO paid_by
        ORDER BY ii.requested_at DESC NULLS LAST, ii.created_at DESC -- Sửa lại ORDER BY nếu cần
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    return result.rows.map(row => ({
        ...row,
        total_amount: row.total_amount ? parseFloat(row.total_amount) : null
    }));
};

/**
 * Lấy tổng số phiếu nhập kho (để phân trang)
 */
export const countAllImports = async () => {
    const result = await pool.query('SELECT COUNT(*) FROM inventory_imports');
    return parseInt(result.rows[0].count, 10);
};


/**
 * Tìm chi tiết phiếu nhập kho theo ID - [CẬP NHẬT] Thêm tên người thanh toán
 */
export const findImportById = async (id: number) => {
    const importQuery = `
        SELECT
            ii.*, s.name as supplier_name,
            req_u.name as requested_by_name,
            app_u.name as approved_by_name,
            rec_u.name as received_by_name,
            pay_u.name as paid_by_name -- <<--- THÊM TÊN NGƯỜI THANH TOÁN
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users req_u ON ii.requested_by = req_u.id
        LEFT JOIN users app_u ON ii.approved_by = app_u.id
        LEFT JOIN users rec_u ON ii.received_by = rec_u.id
        LEFT JOIN users pay_u ON ii.paid_by = pay_u.id -- <<--- JOIN THÊM BẢNG USERS CHO paid_by
        WHERE ii.id = $1`;
    const importResult = await pool.query(importQuery, [id]);
    if (importResult.rows.length === 0) return null;

    const detailsQuery = `
        SELECT iid.*,
               p.name as product_name, p.images->>'thumbnail' as product_image,
               pv.name as variant_name, pv.sku, pv.image as variant_image
        FROM inventory_import_details iid
        JOIN product_variants pv ON iid.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE iid.import_id = $1 ORDER BY p.name, pv.name`;
    const detailsResult = await pool.query(detailsQuery, [id]);

    const details = detailsResult.rows.map(d => ({
        ...d,
        import_quantity: parseInt(d.import_quantity, 10),
        import_price: parseFloat(d.import_price)
    }));

    return {
        ...importResult.rows[0],
        total_amount: importResult.rows[0].total_amount ? parseFloat(importResult.rows[0].total_amount) : null,
        details: details
    };
};

/**
 * BƯỚC 1: Nhân viên kho tạo một yêu cầu nhập hàng (status: 'requested').
 */
export const requestImport = async (importData: Pick<InventoryImport, 'import_code' | 'note'>, detailsData: Array<Pick<InventoryImportDetail, 'product_id' | 'variant_id' | 'import_quantity'>>, requestedBy: number): Promise<InventoryImport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { import_code, note } = importData;
        const importResult = await client.query(
            `INSERT INTO inventory_imports (import_code, note, status, requested_by, requested_at, payment_status)
             VALUES ($1, $2, 'requested', $3, NOW(), 'unpaid') RETURNING *`,
            [import_code || `REQ-${Date.now()}`, note, requestedBy]
        );
        const newImport = importResult.rows[0];

        const detailPromises = detailsData.map(detail => {
            if (!detail.variant_id || !detail.import_quantity || detail.import_quantity <= 0) {
                throw new Error('Mỗi sản phẩm phải có variant_id và số lượng nhập hợp lệ (> 0).');
            }
            return client.query(
                `INSERT INTO inventory_import_details (import_id, product_id, variant_id, import_quantity, import_price)
                 VALUES ($1, $2, $3, $4, 0)`,
                [newImport.id, detail.product_id, detail.variant_id, detail.import_quantity]
            );
        });
        await Promise.all(detailPromises);

        await client.query('COMMIT');
        return newImport;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in requestImport:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * BƯỚC 2: Quản lý phê duyệt (approve), từ chối (reject) hoặc hủy (cancel) yêu cầu nhập hàng.
 */
export const reviewImportRequest = async (
    importId: number,
    action: 'approve' | 'reject' | 'cancel',
    data: { supplier_id?: number; details?: Array<Pick<InventoryImportDetail, 'id' | 'import_quantity' | 'import_price'>>; note?: string },
    userId: number
): Promise<{ success: boolean; message: string; importData?: InventoryImport }> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentResult = await client.query("SELECT status, requested_by FROM inventory_imports WHERE id = $1 FOR UPDATE", [importId]);
        if (currentResult.rows.length === 0) throw new Error('Không tìm thấy phiếu yêu cầu nhập kho.');

        const currentStatus = currentResult.rows[0].status;
        if (currentStatus !== 'requested') {
            throw new Error(`Phiếu đang ở trạng thái "${currentStatus}", không thể ${action}.`);
        }

        let newStatus: InventoryImport['status'];
        let message = '';
        const actionNote = data.note || '';

        if (action === 'cancel') {
            newStatus = 'cancelled';
            message = 'Đã hủy phiếu yêu cầu nhập kho.';
            const finalNote = `Cancelled by User ${userId}: ${actionNote}`;
            await client.query(
                `UPDATE inventory_imports SET status = $1, notes = COALESCE(notes, '') || E'\\n' || $2::TEXT, updated_at = NOW() WHERE id = $3`,
                [newStatus, finalNote, importId]
            );
        } else if (action === 'reject') {
            newStatus = 'rejected';
            message = 'Đã từ chối phiếu yêu cầu nhập kho.';
            const finalNote = `Rejected by User ${userId}: ${actionNote}`;
            await client.query(
                `UPDATE inventory_imports SET status = $1, notes = COALESCE(notes, '') || E'\\n' || $2::TEXT, approved_by = $3, approved_at = NOW(), updated_at = NOW() WHERE id = $4`,
                [newStatus, finalNote, userId, importId]
            );
        } else if (action === 'approve') {
            const { supplier_id, details } = data;
            if (!supplier_id || !details || details.length === 0) {
                throw new Error('Phê duyệt yêu cầu cần có Nhà cung cấp và chi tiết giá sản phẩm.');
            }

            let totalAmount = 0;
            const detailUpdatePromises = details.map(detail => {
                if (detail.import_price < 0 || detail.import_quantity <= 0) {
                    throw new Error(`Giá (${detail.import_price}) và số lượng (${detail.import_quantity}) không hợp lệ.`);
                }
                totalAmount += detail.import_quantity * detail.import_price;
                return client.query(
                    "UPDATE inventory_import_details SET import_price = $1, import_quantity = $2 WHERE id = $3 AND import_id = $4",
                    [detail.import_price, detail.import_quantity, detail.id, importId]
                );
            });
            await Promise.all(detailUpdatePromises);

            newStatus = 'approved';
            message = 'Đã phê duyệt phiếu yêu cầu nhập kho.';
            const finalNote = `Approved by User ${userId}: ${actionNote}`;
            await client.query(
                `UPDATE inventory_imports
                 SET status = $1, supplier_id = $2, approved_by = $3, approved_at = NOW(),
                     total_amount = $4, notes = COALESCE(notes, '') || E'\\n' || $5::TEXT, updated_at = NOW()
                 WHERE id = $6`,
                [newStatus, supplier_id, userId, totalAmount, finalNote, importId]
            );
        } else {
            throw new Error(`Hành động "${action}" không hợp lệ.`);
        }

        await client.query('COMMIT');
        // Gọi lại findImportById để lấy dữ liệu mới nhất bao gồm cả tên người dùng
        const updatedImport = await findImportById(importId);
        return { success: true, message, importData: updatedImport || undefined };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error during reviewImportRequest (Action: ${action}):`, error);
        throw error;
    } finally {
        client.release();
    }
};


/**
 * BƯỚC 3: Kế toán xác nhận đã thanh toán cho nhà cung cấp - [CẬP NHẬT] Lưu paid_by
 */
export const markAsPaid = async (importId: number, paidBy: number): Promise<boolean> => {
    // Giả định bảng inventory_imports đã có cột paid_by BIGINT REFERENCES users(id)
    const result = await pool.query(
        `UPDATE inventory_imports
         SET payment_status = 'paid', paid_by = $2, updated_at = NOW()
         WHERE id = $1 AND status IN ('approved', 'completed') AND payment_status = 'unpaid' -- Cho phép đánh dấu paid cả khi đã completed
         RETURNING id`,
        [importId, paidBy] // Truyền paidBy vào tham số $2
    );
    return (result.rowCount ?? 0) > 0;
};

/**
 * BƯỚC 4: Nhân viên kho xác nhận đã nhận đủ hàng và CỘNG TỒN KHO.
 */
export const receiveImport = async (importId: number, receivedBy: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentResult = await client.query("SELECT status FROM inventory_imports WHERE id = $1 FOR UPDATE", [importId]);
        if (currentResult.rows.length === 0) throw new Error('Không tìm thấy phiếu nhập kho.');
        const currentStatus = currentResult.rows[0].status;
        if (currentStatus !== 'approved' && currentStatus !== 'paid') { // Cho phép nhận cả khi đã paid
            throw new Error(`Không thể nhận hàng cho phiếu đang ở trạng thái "${currentStatus}".`);
        }

        const detailsResult = await client.query("SELECT variant_id, import_quantity FROM inventory_import_details WHERE import_id = $1", [importId]);
        if (detailsResult.rows.length === 0) throw new Error("Phiếu nhập kho không có chi tiết sản phẩm.");

        const inventoryUpdatePromises = detailsResult.rows.map(detail =>
            client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES (0, $1, $2)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + EXCLUDED.quantity`,
                [detail.variant_id, detail.import_quantity]
            )
        );
        await Promise.all(inventoryUpdatePromises);

        await client.query(
            "UPDATE inventory_imports SET status = 'completed', received_by = $1, received_at = NOW(), updated_at = NOW() WHERE id = $2",
            [receivedBy, importId]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in receiveImport:", error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * [HÀM MỚI] Nhân viên kho từ chối nhận hàng (do sai hàng, hỏng hóc...).
 */
export const rejectReceipt = async (importId: number, rejectedBy: number, reason: string): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentResult = await client.query("SELECT status FROM inventory_imports WHERE id = $1 FOR UPDATE", [importId]);
        if (currentResult.rows.length === 0) throw new Error('Không tìm thấy phiếu nhập kho.');
        const currentStatus = currentResult.rows[0].status;
        if (currentStatus !== 'approved' && currentStatus !== 'paid') {
            throw new Error(`Không thể từ chối nhận hàng cho phiếu đang ở trạng thái "${currentStatus}".`);
        }

        const finalNote = `Receipt Rejected by User ${rejectedBy}: ${reason}`;
        await client.query(
            `UPDATE inventory_imports
             SET status = 'receipt_rejected', received_by = $1, received_at = NOW(),
                 notes = COALESCE(notes,'') || E'\\n' || $2::TEXT, updated_at = NOW()
             WHERE id = $3`,
            [rejectedBy, finalNote, importId]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in rejectReceipt:", error);
        throw error;
    } finally {
        client.release();
    }
};
import pool from '../../../config/db';
import { PoolClient } from 'pg';
import { InventoryImport, InventoryImportDetail } from '../../types/inventory/inventory.type'; // Đảm bảo import đúng type

type CreateImportInput = Omit<InventoryImport, 'id' | 'created_at' | 'updated_at' | 'total_amount' | 'status' | 'payment_status' | 'import_date' | 'approved_by' | 'approved_at' | 'received_by' | 'received_at' | 'supplier_id'> & { import_date?: Date | string };
type CreateImportDetailInput = Omit<InventoryImportDetail, 'id' | 'import_id' | 'import_price'> & { import_price?: number }; // import_price có thể chưa có khi request

// ===========================================
// == PHIẾU NHẬP KHO (IMPORTS) ==
// ===========================================

/**
 * Lấy danh sách phiếu nhập kho (phân trang)
 */
export const findAllImports = async (limit: number, offset: number) => {
    const query = `
        SELECT ii.*, s.name as supplier_name,
               req_u.name as requested_by_name,
               app_u.name as approved_by_name,
               rec_u.name as received_by_name
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users req_u ON ii.requested_by = req_u.id
        LEFT JOIN users app_u ON ii.approved_by = app_u.id
        LEFT JOIN users rec_u ON ii.received_by = rec_u.id
        ORDER BY ii.requested_at DESC NULLS LAST, ii.id DESC
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    // Chuyển đổi total_amount sang number
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
 * Tìm chi tiết phiếu nhập kho theo ID
 */
export const findImportById = async (id: number) => {
    const importQuery = `
        SELECT ii.*, s.name as supplier_name,
               req_u.name as requested_by_name,
               app_u.name as approved_by_name,
               rec_u.name as received_by_name
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users req_u ON ii.requested_by = req_u.id
        LEFT JOIN users app_u ON ii.approved_by = app_u.id
        LEFT JOIN users rec_u ON ii.received_by = rec_u.id
        WHERE ii.id = $1`;
    const importResult = await pool.query(importQuery, [id]);
    if (importResult.rows.length === 0) return null;

    const detailsQuery = `
        SELECT iid.*,
               p.name as product_name, p.images->>'thumbnail' as product_image,
               pv.name as variant_name, pv.sku, pv.image as variant_image
        FROM inventory_import_details iid
        JOIN product_variants pv ON iid.variant_id = pv.id -- Use JOIN for variants
        JOIN products p ON pv.product_id = p.id           -- Join products via variants
        WHERE iid.import_id = $1 ORDER BY p.name, pv.name`;
    const detailsResult = await pool.query(detailsQuery, [id]);

    // Chuyển đổi giá và số lượng sang number
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

        // Tạo phiếu nhập chính
        const importResult = await client.query(
            `INSERT INTO inventory_imports (import_code, note, status, requested_by, requested_at, payment_status)
             VALUES ($1, $2, 'requested', $3, NOW(), 'unpaid') RETURNING *`,
            [import_code || `REQ-${Date.now()}`, note, requestedBy]
        );
        const newImport = importResult.rows[0];

        // Thêm chi tiết phiếu nhập (giá tạm thời là 0)
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
    action: 'approve' | 'reject' | 'cancel', // Thêm 'reject'
    data: { supplier_id?: number; details?: Array<Pick<InventoryImportDetail, 'id' | 'import_quantity' | 'import_price'>>; note?: string },
    userId: number // ID của người thực hiện (approve/reject/cancel)
): Promise<{ success: boolean; message: string; importData?: InventoryImport }> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentResult = await client.query("SELECT status, requested_by FROM inventory_imports WHERE id = $1 FOR UPDATE", [importId]);
        if (currentResult.rows.length === 0) throw new Error('Không tìm thấy phiếu yêu cầu nhập kho.');

        const currentStatus = currentResult.rows[0].status;
        const requesterId = currentResult.rows[0].requested_by;

        // Chỉ có thể review phiếu đang ở trạng thái 'requested'
        if (currentStatus !== 'requested') {
            throw new Error(`Phiếu đang ở trạng thái "${currentStatus}", không thể ${action}.`);
        }

        let newStatus: InventoryImport['status'];
        let message = '';
        let finalNote = data.note || ''; // Ghi chú cho hành động này

        if (action === 'cancel') {
            // Chỉ người yêu cầu mới được cancel? (Tùy nghiệp vụ)
            // if (requesterId !== userId) throw new Error('Bạn không có quyền hủy yêu cầu này.');
            newStatus = 'cancelled';
            message = 'Đã hủy phiếu yêu cầu nhập kho.';
            finalNote = `Cancelled by User ${userId}: ${finalNote}`;
            await client.query(
                "UPDATE inventory_imports SET status = $1, notes = CONCAT(COALESCE(notes,''), E'\\n', $2), updated_at = NOW() WHERE id = $3",
                [newStatus, finalNote, importId]
            );
        } else if (action === 'reject') {
            newStatus = 'rejected'; // Trạng thái mới
            message = 'Đã từ chối phiếu yêu cầu nhập kho.';
            finalNote = `Rejected by User ${userId}: ${finalNote}`;
            await client.query(
                "UPDATE inventory_imports SET status = $1, notes = CONCAT(COALESCE(notes,''), E'\\n', $2), approved_by = $3, approved_at = NOW(), updated_at = NOW() WHERE id = $4",
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
                    throw new Error(`Giá (${detail.import_price}) và số lượng (${detail.import_quantity}) phải hợp lệ cho item ID ${detail.id}.`);
                }
                totalAmount += detail.import_quantity * detail.import_price;
                // Cập nhật lại cả số lượng nếu quản lý cho phép sửa
                return client.query(
                    "UPDATE inventory_import_details SET import_price = $1, import_quantity = $2 WHERE id = $3 AND import_id = $4",
                    [detail.import_price, detail.import_quantity, detail.id, importId]
                );
            });
            await Promise.all(detailUpdatePromises);

            newStatus = 'approved';
            message = 'Đã phê duyệt phiếu yêu cầu nhập kho.';
            finalNote = `Approved by User ${userId}: ${finalNote}`;
            await client.query(
                `UPDATE inventory_imports
                 SET status = $1, supplier_id = $2, approved_by = $3, approved_at = NOW(),
                     total_amount = $4, notes = COALESCE(notes, '') || E'\\n' || $5::TEXT, updated_at = NOW()
                 WHERE id = $6`,
                [newStatus, supplier_id, userId, totalAmount, finalNote, importId] // Tham số giữ nguyên
            );
        } else {
            throw new Error(`Hành động "${action}" không hợp lệ.`);
        }

        await client.query('COMMIT');
        const updatedImport = await findImportById(importId); // Lấy lại thông tin đầy đủ
        return { success: true, message, importData: updatedImport || undefined };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error during reviewImportRequest (Action: ${action}):`, error);
        throw error; // Ném lỗi để controller xử lý
    } finally {
        client.release();
    }
};


/**
 * BƯỚC 3: Kế toán xác nhận đã thanh toán cho nhà cung cấp.
 */
export const markAsPaid = async (importId: number, paidBy: number): Promise<boolean> => {
    const result = await pool.query(
        "UPDATE inventory_imports SET payment_status = 'paid', updated_at = NOW() WHERE id = $1 AND status = 'approved' AND payment_status = 'unpaid' RETURNING id",
        [importId]
    );
    // Ghi log hoặc history nếu cần
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
        // Chỉ nhận hàng khi đã được duyệt (hoặc đã thanh toán tùy nghiệp vụ)
        if (currentStatus !== 'approved' && currentStatus !== 'paid') {
            throw new Error(`Không thể nhận hàng cho phiếu đang ở trạng thái "${currentStatus}". Phiếu cần được phê duyệt trước.`);
        }

        const detailsResult = await client.query("SELECT variant_id, import_quantity FROM inventory_import_details WHERE import_id = $1", [importId]);
        if (detailsResult.rows.length === 0) {
             throw new Error("Phiếu nhập kho không có chi tiết sản phẩm.");
        }

        // Cộng tồn kho cho từng sản phẩm vào kho tổng (branch_id = 0)
        const inventoryUpdatePromises = detailsResult.rows.map(detail =>
            client.query(
                `INSERT INTO branch_inventories (branch_id, variant_id, quantity) VALUES (0, $1, $2)
                 ON CONFLICT (branch_id, variant_id) DO UPDATE SET quantity = branch_inventories.quantity + EXCLUDED.quantity`,
                [detail.variant_id, detail.import_quantity]
            )
        );
        await Promise.all(inventoryUpdatePromises);

        // Cập nhật trạng thái phiếu nhập thành 'completed'
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
        // Chỉ từ chối nhận hàng khi đã được duyệt (hoặc đã thanh toán)
        if (currentStatus !== 'approved' && currentStatus !== 'paid') {
            throw new Error(`Không thể từ chối nhận hàng cho phiếu đang ở trạng thái "${currentStatus}".`);
        }

        // Cập nhật trạng thái phiếu nhập thành 'receipt_rejected'
        const finalNote = `Receipt Rejected by User ${rejectedBy}: ${reason}`;
        await client.query(
            `UPDATE inventory_imports
             SET status = 'receipt_rejected', received_by = $1, received_at = NOW(),
                 notes = CONCAT(COALESCE(notes,''), E'\\n', $2), updated_at = NOW()
             WHERE id = $3`,
            [rejectedBy, finalNote, importId]
        );

        // KHÔNG CỘNG TỒN KHO KHI TỪ CHỐI NHẬN

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
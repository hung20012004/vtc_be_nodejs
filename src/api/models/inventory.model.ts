import pool from '../../config/db';
import { InventoryImport, InventoryImportDetail,InventoryExport ,InventoryExportDetail } from '../types/inventory.type';

// Kiểu dữ liệu cho việc tạo phiếu nhập kho
type CreateImportInput = Omit<InventoryImport, 'id' | 'created_at' | 'updated_at' | 'total_amount'>;

// Kiểu dữ liệu cho việc tạo chi tiết phiếu nhập, bao gồm các trường theo dõi lô hàng
type CreateImportDetailInput = Omit<InventoryImportDetail, 'id' | 'import_id'>;

/**
 * Lấy danh sách tất cả phiếu nhập kho, có phân trang.
 * @param limit Số lượng phiếu mỗi trang
 * @param offset Vị trí bắt đầu
 * @returns Danh sách phiếu nhập kho
 */
export const findAllImports = async (limit: number, offset: number): Promise<InventoryImport[]> => {
    const result = await pool.query(
        `SELECT ii.*, s.name as supplier_name
         FROM inventory_imports ii
         LEFT JOIN suppliers s ON ii.supplier_id = s.id
         ORDER BY ii.import_date DESC, ii.id DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return result.rows;
};

/**
 * Tìm một phiếu nhập kho và tất cả chi tiết của nó bằng ID.
 * @param id ID của phiếu nhập
 * @returns Thông tin phiếu nhập và danh sách chi tiết sản phẩm
 */
export const findImportById = async (id: number) => {
    const importResult = await pool.query('SELECT * FROM inventory_imports WHERE id = $1', [id]);
    if (importResult.rows.length === 0) return null;

    const detailsResult = await pool.query(
        `SELECT iid.*, p.name as product_name, p.sku
         FROM inventory_import_details iid
         JOIN products p ON iid.product_id = p.id
         WHERE iid.import_id = $1`, [id]
    );

    return {
        ...importResult.rows[0],
        details: detailsResult.rows
    };
};

/**
 * Tạo một phiếu nhập kho mới cùng các chi tiết của nó.
 * Hàm này sử dụng transaction để đảm bảo toàn vẹn dữ liệu:
 * 1. Tạo phiếu nhập.
 * 2. Thêm các dòng chi tiết.
 * 3. Thêm các dòng tồn kho mới tương ứng với mỗi lô hàng.
 * 4. Cập nhật tổng số lượng tồn kho trong bảng `products`.
 */
export const createImport = async (importData: CreateImportInput, detailsData: CreateImportDetailInput[], createdBy: number): Promise<InventoryImport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // BẮT ĐẦU TRANSACTION

        // 1. Tạo phiếu nhập kho master
        const { import_code, supplier_id, import_date, status, note } = importData;
        const importResult = await client.query(
            `INSERT INTO inventory_imports (import_code, supplier_id, import_date, status, note, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [import_code, supplier_id, import_date, status, note, createdBy]
        );
        const newImport = importResult.rows[0];
        let totalAmount = 0;
        const productIdsToUpdate: number[] = [];

        // 2. Thêm chi tiết phiếu nhập VÀ tạo dòng tồn kho tương ứng
        for (const detail of detailsData) {
            const { product_id, variant_id, import_quantity, import_price, manufacture_date, expiry_date, lot_number } = detail;
            
            // a. Thêm dòng chi tiết vào `inventory_import_details`
            await client.query(
                `INSERT INTO inventory_import_details (import_id, product_id, variant_id, import_quantity, import_price, manufacture_date, expiry_date, lot_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [newImport.id, product_id, variant_id, import_quantity, import_price, manufacture_date, expiry_date, lot_number]
            );

            // b. Thêm một dòng TỒN KHO MỚI cho lô hàng này vào `inventory_stocks`
            // Mỗi lần nhập hàng sẽ tạo một dòng tồn kho mới, không cộng dồn vào dòng cũ
            await client.query(
                `INSERT INTO inventory_stocks (product_id, variant_id, import_id, import_price, import_quantity, available_quantity, manufacture_date, expiry_date, lot_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [product_id, variant_id, newImport.id, import_price, import_quantity, import_quantity, manufacture_date, expiry_date, lot_number]
            );
            
            totalAmount += import_quantity * import_price;
            if (!productIdsToUpdate.includes(product_id)) {
                productIdsToUpdate.push(product_id);
            }
        }

        // 3. Cập nhật lại tổng tiền cho phiếu nhập master
        await client.query(
            'UPDATE inventory_imports SET total_amount = $1 WHERE id = $2',
            [totalAmount, newImport.id]
        );

        // 4. Cập nhật lại tổng số lượng tồn kho trong bảng `products` cho các sản phẩm bị ảnh hưởng
        for (const productId of productIdsToUpdate) {
            await client.query(
                `UPDATE products
                 SET stock_quantity = (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory_stocks WHERE product_id = $1)
                 WHERE id = $1`,
                [productId]
            );
        }

        await client.query('COMMIT'); // KẾT THÚC TRANSACTION - LƯU TẤT CẢ
        
        // Trả về phiếu nhập đã hoàn chỉnh
        newImport.total_amount = totalAmount;
        return newImport;

    } catch (error) {
        await client.query('ROLLBACK'); // NẾU CÓ LỖI, HỦY BỎ TẤT CẢ
        throw error;
    } finally {
        client.release(); // Luôn trả kết nối về pool
    }
};

/**
 * Lấy tất cả các lô tồn kho của một sản phẩm.
 */
export const findStockByProductId = async (productId: number) => {
    const result = await pool.query('SELECT * FROM inventory_stocks WHERE product_id = $1 ORDER BY expiry_date ASC', [productId]);
    return result.rows;
};

/**
 * Điều chỉnh số lượng tồn kho của một lô hàng cụ thể.
 */
export const adjustStock = async (stockId: number, newQuantity: number, reason: string, userId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Lấy thông tin tồn kho hiện tại
        const stockResult = await client.query('SELECT * FROM inventory_stocks WHERE id = $1 FOR UPDATE', [stockId]);
        if (stockResult.rows.length === 0) throw new Error('Không tìm thấy lô hàng tồn kho.');
        const currentStock = stockResult.rows[0];
        const quantityChange = newQuantity - currentStock.available_quantity;

        // 2. Cập nhật lại số lượng có sẵn
        await client.query(
            'UPDATE inventory_stocks SET available_quantity = $1 WHERE id = $2',
            [newQuantity, stockId]
        );

        // 3. Ghi lại lịch sử điều chỉnh vào bảng `inventory_audits`
        await client.query(
            'INSERT INTO inventory_audits (stock_id, user_id, action, quantity_change, reason) VALUES ($1, $2, $3, $4, $5)',
            [stockId, userId, 'adjustment', quantityChange, reason]
        );
        
        // 4. Cập nhật lại tổng tồn kho của sản phẩm cha
        await client.query(
            `UPDATE products
             SET stock_quantity = (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory_stocks WHERE product_id = $1)
             WHERE id = $1`,
            [currentStock.product_id]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/////////
type CreateExportInput = Omit<InventoryExport, 'id' | 'created_at' | 'updated_at' | 'total_quantity'>;
type CreateExportDetailInput = Omit<InventoryExportDetail, 'id' | 'export_id'>;

export const createExport = async (exportData: CreateExportInput, detailsData: CreateExportDetailInput[], createdBy: number): Promise<InventoryExport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Kiểm tra tồn kho
        for (const detail of detailsData) {
            const stockCheck = await client.query(
                'SELECT COALESCE(SUM(available_quantity), 0) as total FROM inventory_stocks WHERE product_id = $1',
                [detail.product_id]
            );
            if (stockCheck.rows[0].total < detail.quantity) {
                throw new Error(`Không đủ tồn kho cho sản phẩm ID ${detail.product_id}.`);
            }
        }

        // 2. Tạo phiếu xuất kho master
        const { export_code, type, reference_id, export_date, notes } = exportData;
        let totalQuantity = 0;
        const exportResult = await client.query(
            `INSERT INTO inventory_exports (export_code, type, reference_id, export_date, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [export_code, type, reference_id, export_date, notes, createdBy]
        );
        const newExport = exportResult.rows[0];
        const productIdsToUpdate: number[] = [];

        // 3. Thêm chi tiết và trừ kho
        for (const detail of detailsData) {
            let quantityToExport = detail.quantity;
            totalQuantity += quantityToExport;

            // Lấy các lô hàng tồn kho theo FIFO
            const stockBatches = await client.query(
                `SELECT * FROM inventory_stocks WHERE product_id = $1 AND available_quantity > 0 ORDER BY expiry_date ASC, created_at ASC`,
                [detail.product_id]
            );
            
            for (const batch of stockBatches.rows) {
                if (quantityToExport <= 0) break;
                const quantityFromThisBatch = Math.min(batch.available_quantity, quantityToExport);
                
                // Thêm chi tiết phiếu xuất cho từng lô hàng bị trừ kho
                await client.query(
                    `INSERT INTO inventory_export_details (export_id, product_id, variant_id, quantity, unit_price, batch_number, expiry_date, reason)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [newExport.id, detail.product_id, detail.variant_id, quantityFromThisBatch, batch.unit_cost, batch.batch_number, batch.expiry_date, detail.reason]
                );

                // Trừ kho
                await client.query(
                    'UPDATE inventory_stocks SET available_quantity = available_quantity - $1 WHERE id = $2',
                    [quantityFromThisBatch, batch.id]
                );
                quantityToExport -= quantityFromThisBatch;
            }
            
            if (!productIdsToUpdate.includes(detail.product_id)) {
                productIdsToUpdate.push(detail.product_id);
            }
        }
        
        // 4. Cập nhật tổng số lượng xuất và tổng tồn kho
        await client.query('UPDATE inventory_exports SET total_quantity = $1 WHERE id = $2', [totalQuantity, newExport.id]);
        for (const productId of productIdsToUpdate) {
            await client.query(
                `UPDATE products SET stock_quantity = (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory_stocks WHERE product_id = $1) WHERE id = $1`,
                [productId]
            );
        }

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
/**
 * Lấy danh sách tất cả phiếu xuất kho, có phân trang.
 */
export const findAllExports = async (limit: number, offset: number): Promise<InventoryExport[]> => {
    const result = await pool.query(
        'SELECT * FROM inventory_exports ORDER BY export_date DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    return result.rows;
};

/**
 * Tìm một phiếu xuất kho và chi tiết của nó bằng ID.
 */
export const findExportById = async (id: number) => {
    const exportResult = await pool.query('SELECT * FROM inventory_exports WHERE id = $1', [id]);
    if (exportResult.rows.length === 0) return null;

    const detailsResult = await pool.query('SELECT * FROM inventory_export_details WHERE export_id = $1', [id]);
    
    return {
        ...exportResult.rows[0],
        details: detailsResult.rows
    };
};

/**
 * Hủy một phiếu xuất kho.
 * Thao tác này sẽ hoàn trả lại số lượng hàng đã xuất về kho.
 */
export const cancelExport = async (exportId: number, reason: string, userId: number): Promise<boolean> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Lấy thông tin phiếu xuất và kiểm tra trạng thái
        const exportResult = await client.query('SELECT * FROM inventory_exports WHERE id = $1 FOR UPDATE', [exportId]);
        if (exportResult.rows.length === 0) throw new Error('Không tìm thấy phiếu xuất.');
        if (exportResult.rows[0].status === 'cancelled') throw new Error('Phiếu xuất đã được hủy trước đó.');

        // 2. Cập nhật trạng thái phiếu xuất
        await client.query(
            'UPDATE inventory_exports SET status = $1, notes = CONCAT(notes, $2) WHERE id = $3',
            ['cancelled', `\nCancelled: ${reason}`, exportId]
        );

        // 3. Hoàn trả lại hàng vào kho
        const details = await client.query('SELECT * FROM inventory_export_details WHERE export_id = $1', [exportId]);
        const productIdsToUpdate: number[] = [];

        for (const detail of details.rows) {
            // Logic hoàn trả đơn giản nhất là tìm một lô hàng bất kỳ và cộng lại
            // Logic phức tạp hơn có thể yêu cầu tạo lại lô hàng đúng như đã xuất
            await client.query(
                `UPDATE inventory_stocks
                 SET available_quantity = available_quantity + $1
                 WHERE id = (
                     SELECT id FROM inventory_stocks
                     WHERE product_id = $2 ORDER BY created_at DESC LIMIT 1
                 )`,
                [detail.quantity, detail.product_id]
            );
            if (!productIdsToUpdate.includes(detail.product_id)) {
                productIdsToUpdate.push(detail.product_id);
            }
        }
        
        // 4. Cập nhật lại tổng tồn kho của sản phẩm
        for (const productId of productIdsToUpdate) {
            await client.query(
                `UPDATE products SET stock_quantity = (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory_stocks WHERE product_id = $1) WHERE id = $1`,
                [productId]
            );
        }

        // 5. Ghi log cho hành động hủy
        await client.query(
            'INSERT INTO inventory_audits (user_id, action, quantity_change, reason) VALUES ($1, $2, $3, $4)',
            [userId, 'cancel_export', 0, `Cancelled export ID: ${exportId}. Reason: ${reason}`]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
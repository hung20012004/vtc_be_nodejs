import pool from '../../config/db';
import { InventoryImport, InventoryImportDetail } from '../types/inventory_import.type';

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
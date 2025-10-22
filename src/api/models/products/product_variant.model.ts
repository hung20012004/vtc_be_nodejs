import pool from '../../../config/db';
import { ProductVariant } from '../../types/products/product.type';

/**
 * Hàm helper: Cập nhật lại tổng tồn kho của sản phẩm cha
 */
const recalculateProductStock = async (productId: number, client: any) => {
    await client.query(
        `UPDATE products
         SET stock_quantity = (
             SELECT COALESCE(SUM(stock_quantity), 0)
             FROM product_variants
             WHERE product_id = $1
         )
         WHERE id = $1`,
        [productId]
    );
};

export const findByProductId = async (productId: number): Promise<ProductVariant[]> => {
    const result = await pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [productId]);
    return result.rows;
};

// --- HÀM CREATE ĐÃ CẬP NHẬT ---
export const create = async (productId: number, data: Omit<ProductVariant, 'id'|'product_id'|'created_at'|'updated_at'>): Promise<ProductVariant> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lấy tất cả các key từ data để tạo câu lệnh INSERT động
        const columns = Object.keys(data);
        const values = Object.values(data);

        // Thêm product_id vào đầu
        columns.unshift('product_id');
        values.unshift(productId);

        const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.map(col => `"${col}"`).join(', ');

        const query = `INSERT INTO product_variants (${columnNames}) VALUES (${valuePlaceholders}) RETURNING *`;
        
        const result = await client.query(query, values);

        // Cập nhật lại tồn kho sản phẩm cha
        await recalculateProductStock(productId, client);
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// --- HÀM UPDATE KHÔNG CẦN SỬA ĐỔI ---
// Vì hàm này đã được viết động, nó sẽ tự động xử lý các trường length, width, height
export const update = async (variantId: number, data: Partial<Omit<ProductVariant, 'id'|'created_at'|'updated_at'>>): Promise<ProductVariant | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
        if (fields.length === 0) return null;

        const values = Object.values(data);
        const query = `UPDATE product_variants SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
        const result = await client.query(query, [...values, variantId]);
        
        if (result.rows.length > 0) {
            const productId = result.rows[0].product_id;
            await recalculateProductStock(productId, client);
        }
        
        await client.query('COMMIT');
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// --- HÀM DELETE KHÔNG CẦN SỬA ĐỔI ---
export const deleteById = async (variantId: number): Promise<{ success: boolean; productId?: number }> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const variant = await client.query('SELECT product_id FROM product_variants WHERE id = $1', [variantId]);
        if (variant.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false };
        }
        const { product_id: productId } = variant.rows[0];

        const deleteResult = await client.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
        
        await recalculateProductStock(productId, client);
        
        await client.query('COMMIT');
        return { success: (deleteResult.rowCount ?? 0) > 0, productId };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
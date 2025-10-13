import pool from '../../config/db';
import { Product } from '../types/product.type';

export type CreateProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'search_vector'>;
export type UpdateProductInput = Partial<CreateProductInput>;

/**
 * Tìm sản phẩm bằng ID.
 */
export const findProductById = async (id: number): Promise<Product | null> => {
    const result = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Tạo sản phẩm mới.
 */
export const createProduct = async (data: CreateProductInput, createdBy: number): Promise<Product> => {
    const columns: string[] = [];
    const values: any[] = [];
    let valueCounter = 1;

    // Xử lý dữ liệu đầu vào, đặc biệt là trường 'images'
    Object.keys(data).forEach(key => {
        const typedKey = key as keyof CreateProductInput;
        let value = data[typedKey];

        // Nếu là trường 'images' và là một object, chuyển thành chuỗi JSON
        if (typedKey === 'images' && typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }

        if (value !== undefined) {
            columns.push(`"${typedKey}"`);
            values.push(value);
        }
    });

    // Thêm created_by
    columns.push('"created_by"');
    values.push(createdBy);

    const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO products (${columns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows[0];
};

/**
 * Cập nhật thông tin sản phẩm.
 */
export const updateProduct = async (id: number, data: UpdateProductInput): Promise<Product | null> => {
    const updateData = { ...data };

    // Nếu có trường 'images', đảm bảo nó được chuyển thành chuỗi JSON
    if (updateData.images && typeof updateData.images === 'object') {
        updateData.images = JSON.stringify(updateData.images) as any;
    }

    const fields = Object.keys(updateData).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findProductById(id);

    const values = Object.values(updateData);
    const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Xóa (mềm) sản phẩm.
 */
export const deleteProduct = async (id: number): Promise<boolean> => {
    const result = await pool.query('UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
    return (result.rowCount ?? 0) > 0;
};
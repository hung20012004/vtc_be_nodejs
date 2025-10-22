import pool from '../../../config/db';
import { Product } from '../../types/products/product.type';
export type CreateProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'search_vector' | 'variants'>;
export type UpdateProductInput = Partial<CreateProductInput>;

/**
 * [NÂNG CẤP] Tìm sản phẩm bằng ID, lấy kèm tất cả thông tin liên quan.
 * Bao gồm: tên danh mục, tên đơn vị, và danh sách các phiên bản (variants).
 */
export const findProductById = async (id: number): Promise<Product | null> => {
    const result = await pool.query(
        `SELECT 
            p.*, 
            c.name as category_name,
            u.name as unit_name,
            (
                SELECT json_agg(
                    json_build_object(
                        'id', pv.id,
                        'name', pv.name,
                        'sku', pv.sku,
                        'price', pv.price,
                        'stock_quantity', pv.stock_quantity,
                        'weight', pv.weight,
                        'length', pv.length,
                        'width', pv.width,
                        'height', pv.height,
                        'image', pv.image,
                        'is_active', pv.is_active
                    ) ORDER BY pv.id ASC
                )
                FROM product_variants pv
                WHERE pv.product_id = p.id
            ) as variants
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN units u ON p.unit_id = u.id
         WHERE p.id = $1 AND p.deleted_at IS NULL
         GROUP BY p.id, c.name, u.name`,
        [id]
    );
    
    if (result.rows.length === 0) {
        return null;
    }

    // Gán tên vào đối tượng product để tiện sử dụng ở frontend
    const product = result.rows[0];
    product.category_name = result.rows[0].category_name;
    product.unit_name = result.rows[0].unit_name;

    return product;
};

/**
 * [HOÀN THIỆN] Tạo sản phẩm mới với logic xử lý JSON động.
 */
export const createProduct = async (data: CreateProductInput, createdBy: number): Promise<Product> => {
    const columns: string[] = [];
    const values: any[] = [];

    Object.keys(data).forEach(key => {
        const typedKey = key as keyof CreateProductInput;
        let value = data[typedKey];

        // Tự động chuyển đổi các trường object (JSON) thành chuỗi
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }

        if (value !== undefined) {
            columns.push(`"${typedKey}"`);
            values.push(value);
        }
    });

    columns.push('"created_by"');
    values.push(createdBy);

    const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO products (${columns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows[0];
};

/**
 * [HOÀN THIỆN] Cập nhật thông tin sản phẩm với logic xử lý JSON động.
 */
export const updateProduct = async (id: number, data: UpdateProductInput): Promise<Product | null> => {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key in data) {
        const typedKey = key as keyof UpdateProductInput;
        let value = data[typedKey];
        
        // Tự động chuyển đổi các trường object (JSON) thành chuỗi
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }

        if (value !== undefined) {
            fields.push(`"${key}" = $${idx}`);
            values.push(value);
            idx++;
        }
    }

    if (fields.length === 0) {
        return findProductById(id);
    }
    
    values.push(id);
    const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Xóa (mềm) sản phẩm.
 */
export const deleteProduct = async (id: number): Promise<boolean> => {
    const result = await pool.query('UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
    return (result.rowCount ?? 0) > 0;
};
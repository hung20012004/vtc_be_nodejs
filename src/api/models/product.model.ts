// src/api/models/product.model.ts
import pool from '../../config/db';
import { Product } from '../types/product.type';

export type CreateProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'search_vector'>;
export type UpdateProductInput = Partial<CreateProductInput>;

interface FindAllOptions {
    limit: number;
    offset: number;
    search?: string;
    categoryId?: number;
}

export const findAllProducts = async (options: FindAllOptions): Promise<{ products: Product[], total: number }> => {
    const { limit, offset, search, categoryId } = options;
    const queryParams: any[] = [limit, offset];
    let whereClauses = ['p.deleted_at IS NULL'];
    
    if (search) {
        whereClauses.push(`p.search_vector @@ to_tsquery('simple', $${queryParams.length + 1})`);
        queryParams.push(search.split(' ').join(' & '));
    }
    if (categoryId) {
        whereClauses.push(`p.category_id = $${queryParams.length + 1}`);
        queryParams.push(categoryId);
    }

    const whereString = whereClauses.join(' AND ');

    const productsQuery = pool.query(
        `SELECT p.*, c.name as category_name, u.name as unit_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN units u ON p.unit_id = u.id
         WHERE ${whereString}
         ORDER BY p.id DESC
         LIMIT $1 OFFSET $2`,
        queryParams
    );

    const totalQuery = pool.query(`SELECT COUNT(*) FROM products p WHERE ${whereString}`, queryParams.slice(2));
    
    const [productsResult, totalResult] = await Promise.all([productsQuery, totalQuery]);

    return {
        products: productsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10),
    };
};

export const findProductById = async (id: number): Promise<Product | null> => {
    const result = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const createProduct = async (data: CreateProductInput, createdBy: number): Promise<Product> => {
    const columns = ['name', 'slug', 'category_id', 'unit_id', 'price', 'stock_quantity', 'created_by'];
    const values = [data.name, data.slug, data.category_id, data.unit_id, data.price, data.stock_quantity, createdBy];
    // Thêm các trường tùy chọn nếu chúng tồn tại
    Object.keys(data).forEach(key => {
        if (!columns.includes(key) && (data as any)[key] !== undefined) {
            columns.push(key);
            values.push((data as any)[key]);
        }
    });

    const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO products (${columns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows[0];
};

export const updateProduct = async (id: number, data: UpdateProductInput): Promise<Product | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findProductById(id);

    const values = Object.values(data);
    const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteProduct = async (id: number): Promise<boolean> => {
    const result = await pool.query('UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
    return (result.rowCount ?? 0) > 0;
};
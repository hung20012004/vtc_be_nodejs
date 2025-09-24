// src/api/models/productVariant.model.ts
import pool from '../../config/db';
import { ProductVariant } from '../types/product.type';

/**
 * Hàm helper: Cập nhật lại tổng tồn kho của sản phẩm cha
 * dựa trên tổng tồn kho của tất cả các phiên bản.
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

export const create = async (productId: number, data: Omit<ProductVariant, 'id'|'product_id'|'created_at'|'updated_at'>): Promise<ProductVariant> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { name, sku, price, stock_quantity, is_active } = data;
        const result = await client.query(
            `INSERT INTO product_variants (product_id, name, sku, price, stock_quantity, is_active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [productId, name, sku, price, stock_quantity, is_active]
        );
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

export const update = async (variantId: number, data: Partial<Omit<ProductVariant, 'id'|'created_at'|'updated_at'>>): Promise<ProductVariant | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
        if (fields.length === 0) return null; // Không có gì để cập nhật

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

export const deleteById = async (variantId: number): Promise<{ success: boolean; productId?: number }> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Lấy productId trước khi xóa
        const variant = await client.query('SELECT product_id FROM product_variants WHERE id = $1', [variantId]);
        if (variant.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false };
        }
        const { product_id: productId } = variant.rows[0];

        // Xóa phiên bản
        const deleteResult = await client.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
        
        // Cập nhật lại tồn kho sản phẩm cha
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
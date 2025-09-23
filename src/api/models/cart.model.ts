// src/api/models/cart.model.ts
import pool from '../../config/db';
import { CartItem, CartItemWithProductDetails } from '../types/carts.type';

export type AddItemInput = {
    customerId: number;
    productId: number;
    variantId?: number | null;
    quantity: number;
};

/**
 * Lấy tất cả sản phẩm trong giỏ hàng của một khách hàng.
 */
export const getCartByCustomerId = async (customerId: number): Promise<CartItemWithProductDetails[]> => {
  const result = await pool.query(
    `SELECT
        c.id, c.customer_id, c.product_id, c.variant_id, c.quantity,
        p.name as product_name, p.price as product_price, p.images as product_images, p.slug as product_slug
     FROM carts c
     JOIN products p ON c.product_id = p.id
     WHERE c.customer_id = $1
     ORDER BY c.created_at DESC`,
    [customerId]
  );

  return result.rows.map(row => ({
    id: row.id,
    customer_id: row.customer_id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    quantity: row.quantity,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: {
        name: row.product_name,
        price: row.product_price,
        images: row.product_images,
        slug: row.product_slug
    }
  }));
};

/**
 * Thêm sản phẩm vào giỏ hàng hoặc cập nhật số lượng nếu đã tồn tại.
 * Sử dụng ON CONFLICT của PostgreSQL để tối ưu.
 */
export const addOrUpdateItem = async (data: AddItemInput): Promise<CartItem> => {
    const { customerId, productId, variantId = null, quantity } = data;
    const result = await pool.query(
        `INSERT INTO carts (customer_id, product_id, variant_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_id, product_id, variant_id)
         DO UPDATE SET quantity = carts.quantity + EXCLUDED.quantity
         RETURNING *`,
        [customerId, productId, variantId, quantity]
    );
    return result.rows[0];
};

/**
 * Cập nhật số lượng của một sản phẩm trong giỏ hàng.
 */
export const updateItemQuantity = async (itemId: number, customerId: number, quantity: number): Promise<CartItem | null> => {
    if (quantity <= 0) {
        // Nếu số lượng <= 0, xóa sản phẩm
        await removeItem(itemId, customerId);
        return null;
    }
    const result = await pool.query(
        'UPDATE carts SET quantity = $1 WHERE id = $2 AND customer_id = $3 RETURNING *',
        [quantity, itemId, customerId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Xóa một sản phẩm khỏi giỏ hàng.
 */
export const removeItem = async (itemId: number, customerId: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM carts WHERE id = $1 AND customer_id = $2', [itemId, customerId]);
  return (result.rowCount ?? 0) > 0;
};

/**
 * Xóa toàn bộ sản phẩm trong giỏ hàng của một khách hàng.
 */
export const clearCart = async (customerId: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM carts WHERE customer_id = $1', [customerId]);
    return (result.rowCount ?? 0) > 0;
}
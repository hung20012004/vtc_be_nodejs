import pool from '../../../config/db';
import { CartItem, CartItemWithProductDetails } from '../../types/shopping/carts.type';

export type AddItemInput = {
    customerId: number;
    variantId: number;
    quantity: number;
};

export const getCartByCustomerId = async (customerId: number): Promise<CartItemWithProductDetails[]> => {
    const result = await pool.query(
        `SELECT
            c.id, c.quantity,
            pv.id as variant_id, pv.name as variant_name, pv.price, pv.image as variant_image, pv.sku,
            p.id as product_id, p.name as product_name, p.slug as product_slug
         FROM carts c
         JOIN product_variants pv ON c.variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE c.customer_id = $1
         ORDER BY c.created_at DESC`,
        [customerId]
    );

    // Map kết quả từ DB thành cấu trúc JSON lồng nhau, dễ sử dụng hơn ở front-end
    return result.rows.map(row => ({
        id: row.id,
        quantity: row.quantity,
        variant: {
            id: row.variant_id,
            name: row.variant_name,
            price: parseFloat(row.price),
            image: row.variant_image,
            sku: row.sku,
        },
        product: {
            id: row.product_id,
            name: row.product_name,
            slug: row.product_slug
        }
    }));
};


export const addOrUpdateItem = async (data: AddItemInput): Promise<CartItem> => {
    const { customerId, variantId, quantity } = data;
    const result = await pool.query(
        `INSERT INTO carts (customer_id, variant_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (customer_id, variant_id)
         DO UPDATE SET quantity = carts.quantity + EXCLUDED.quantity
         RETURNING *`,
        [customerId, variantId, quantity]
    );
    return result.rows[0];
};

export const updateItemQuantity = async (cartItemId: number, quantity: number, customerId: number): Promise<CartItem | null> => {
    const result = await pool.query(
        'UPDATE carts SET quantity = $1 WHERE id = $2 AND customer_id = $3 RETURNING *',
        [quantity, cartItemId, customerId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const removeItem = async (cartItemId: number, customerId: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM carts WHERE id = $1 AND customer_id = $2', [cartItemId, customerId]);
    return (result.rowCount ?? 0) > 0;
};

export const clearCart = async (customerId: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM carts WHERE customer_id = $1', [customerId]);
    return (result.rowCount ?? 0) > 0;
};
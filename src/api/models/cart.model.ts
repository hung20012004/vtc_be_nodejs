import pool from '../../config/db';
import { CartItem, CartItemWithProductDetails } from '../types/carts.type';

export type AddItemInput = {
    customerId: number;
    productId: number;
    variantId?: number | null;
    quantity: number;
};

export const getCartByCustomerId = async (customerId: number): Promise<CartItemWithProductDetails[]> => {
  const result = await pool.query(
    `SELECT
        c.id, c.customer_id, c.product_id, c.variant_id, c.quantity, c.created_at, c.updated_at,
        p.name as product_name,
        p.slug as product_slug,
        COALESCE(pv.price, p.price) as final_price,
        COALESCE(pv.image, (p.images ->> 'thumbnail')) as final_image
     FROM carts c
     JOIN products p ON c.product_id = p.id
     LEFT JOIN product_variants pv ON c.variant_id = pv.id
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
        price: parseFloat(row.final_price),
        images: {
            thumbnail: row.final_image,
            gallery: [] 
        },
        slug: row.product_slug
    }
  }));
};


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
}
import pool from '../../../config/db';
import { CartItem, CartItemWithProductDetails } from '../../types/shopping/carts.type';

export type AddItemInput = {
    customerId: number;
    variantId: number;
    quantity: number;
};

export const getCartByCustomerId = async (customerId: number): Promise<CartItem[]> => {
    const query = `
        SELECT
            c.id, c.customer_id, c.variant_id, c.quantity, c.created_at, c.updated_at,
            -- Lấy thông tin chi tiết từ variants và products
            p.name || COALESCE(' - ' || pv.name, '') as product_name,
            pv.price,
            pv.sku,
            COALESCE(pv.image, p.images->>'thumbnail') as image, -- Ưu tiên ảnh variant, fallback về ảnh product
            pv.weight -- <<--- LẤY THÊM WEIGHT TỪ PRODUCT_VARIANTS
        FROM carts c
        JOIN product_variants pv ON c.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE c.customer_id = $1
        ORDER BY c.created_at DESC; -- Hoặc ORDER BY p.name, pv.name
    `;
    const result = await pool.query(query, [customerId]);

    // Chuyển đổi kiểu dữ liệu nếu cần (price và weight từ numeric/decimal sang number)
    return result.rows.map(row => ({
        ...row,
        price: parseFloat(row.price),
        weight: row.weight ? parseFloat(row.weight) : null, // Chuyển đổi weight và xử lý NULL
        quantity: parseInt(row.quantity, 10)
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
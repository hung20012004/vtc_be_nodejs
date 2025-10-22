// src/api/models/wishlist.model.ts
import pool from '../../../config/db';
import { WishlistItemWithProductDetails } from '../../types/shopping/wishlist.type';

/**
 * Lấy tất cả sản phẩm trong wishlist của một khách hàng.
 */
export const getWishlistByCustomerId = async (customerId: number): Promise<WishlistItemWithProductDetails[]> => {
  const result = await pool.query(
    `SELECT
        p.id, p.name, p.slug, p.price, p.images
     FROM wishlists w
     JOIN products p ON w.product_id = p.id
     WHERE w.customer_id = $1 AND p.deleted_at IS NULL`,
    [customerId]
  );

  return result.rows.map(row => ({
    product: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: row.price,
        images: row.images
    }
  }));
};

/**
 * Thêm một sản phẩm vào wishlist.
 */
export const addItemToWishlist = async (customerId: number, productId: number): Promise<void> => {
  await pool.query(
    'INSERT INTO wishlists (customer_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [customerId, productId]
  );
};

/**
 * Xóa một sản phẩm khỏi wishlist.
 */
export const removeItemFromWishlist = async (customerId: number, productId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM wishlists WHERE customer_id = $1 AND product_id = $2',
    [customerId, productId]
  );
  return (result.rowCount ?? 0) > 0;
};
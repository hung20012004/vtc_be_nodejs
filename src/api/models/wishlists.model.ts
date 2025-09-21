import pool from '../../config/db';
import { Wishlist } from '../types/wishlists.type';

export const findWishlist = async (
  customer_id: number,
  product_id: number
): Promise<Wishlist | null> => {
  const result = await pool.query(
    'SELECT * FROM wishlists WHERE customer_id = $1 AND product_id = $2',
    [customer_id, product_id]
  );
  return result.rows[0] || null;
};

export const getAllWishlists = async (): Promise<Wishlist[]> => {
  const result = await pool.query('SELECT * FROM wishlists');
  return result.rows;
};

export const createWishlist = async (data: Wishlist): Promise<Wishlist> => {
  const { customer_id, product_id } = data;
  const result = await pool.query(
    `INSERT INTO wishlists (customer_id, product_id) VALUES ($1, $2) RETURNING *`,
    [customer_id, product_id]
  );
  return result.rows[0];
};

export const deleteWishlist = async (
  customer_id: number,
  product_id: number
): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM wishlists WHERE customer_id = $1 AND product_id = $2',
    [customer_id, product_id]
  );
  return (result.rowCount ?? 0) > 0;
};
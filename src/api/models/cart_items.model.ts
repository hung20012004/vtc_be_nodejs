import pool from '../../config/db';
import { CartItem } from '../types/cart_items.type';

export type CreateCartItemInput = Pick<CartItem, 'cart_id' | 'product_id' | 'quantity'>;

export const findCartItemById = async (id: number): Promise<CartItem | null> => {
  const result = await pool.query('SELECT * FROM cart_items WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllCartItems = async (): Promise<CartItem[]> => {
  const result = await pool.query('SELECT * FROM cart_items');
  return result.rows;
};

export const createCartItem = async (data: CreateCartItemInput): Promise<CartItem> => {
  const { cart_id, product_id, quantity } = data;
  const result = await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *`,
    [cart_id, product_id, quantity]
  );
  return result.rows[0];
};

export const updateCartItem = async (
  id: number,
  data: Partial<CreateCartItemInput>
): Promise<CartItem | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key in data) {
    fields.push(`${key} = $${idx}`);
    values.push((data as any)[key]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE cart_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteCartItem = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM cart_items WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
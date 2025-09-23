import pool from '../../config/db';
import { Cart } from '../types/carts.type';

export type CreateCartInput = Pick<Cart, 'customer_id' | 'created_at' | 'updated_at'>;

export const findCartById = async (id: number): Promise<Cart | null> => {
  const result = await pool.query('SELECT * FROM carts WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllCarts = async (): Promise<Cart[]> => {
  const result = await pool.query('SELECT * FROM carts');
  return result.rows;
};

export const createCart = async (data: CreateCartInput): Promise<Cart> => {
  const { customer_id, created_at, updated_at } = data;
  const result = await pool.query(
    `INSERT INTO carts (customer_id, created_at, updated_at) VALUES ($1, $2, $3) RETURNING *`,
    [customer_id, created_at, updated_at]
  );
  return result.rows[0];
};

export const updateCart = async (
  id: number,
  data: Partial<CreateCartInput>
): Promise<Cart | null> => {
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
    `UPDATE carts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteCart = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM carts WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
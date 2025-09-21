import pool from '../../config/db';
import { ShippingMethod } from '../types/shipping_methods.type';

export type CreateShippingMethodInput = Pick<ShippingMethod, 'name' | 'cost' | 'is_active'>;

export const findShippingMethodById = async (id: number): Promise<ShippingMethod | null> => {
  const result = await pool.query('SELECT * FROM shipping_methods WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllShippingMethods = async (): Promise<ShippingMethod[]> => {
  const result = await pool.query('SELECT * FROM shipping_methods');
  return result.rows;
};

export const createShippingMethod = async (data: CreateShippingMethodInput): Promise<ShippingMethod> => {
  const { name, cost, is_active } = data;
  const result = await pool.query(
    `INSERT INTO shipping_methods (name, cost, is_active) VALUES ($1, $2, $3) RETURNING *`,
    [name, cost, is_active]
  );
  return result.rows[0];
};

export const updateShippingMethod = async (
  id: number,
  data: Partial<CreateShippingMethodInput>
): Promise<ShippingMethod | null> => {
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
    `UPDATE shipping_methods SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteShippingMethod = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM shipping_methods WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
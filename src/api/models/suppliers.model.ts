import pool from '../../config/db';
import { Supplier } from '../types/suppliers.type';

export type CreateSupplierInput = Pick<Supplier, 'name' | 'code' | 'phone' | 'address' | 'status'>;

export const findSupplierById = async (id: number): Promise<Supplier | null> => {
  const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllSuppliers = async (): Promise<Supplier[]> => {
  const result = await pool.query('SELECT * FROM suppliers');
  return result.rows;
};

export const createSupplier = async (data: CreateSupplierInput): Promise<Supplier> => {
  const { name, code, phone, address, status } = data;
  const result = await pool.query(
    `INSERT INTO suppliers (name, code, phone, address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, code, phone, address, status]
  );
  return result.rows[0];
};

export const updateSupplier = async (
  id: number,
  data: Partial<CreateSupplierInput>
): Promise<Supplier | null> => {
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
    `UPDATE suppliers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteSupplier = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
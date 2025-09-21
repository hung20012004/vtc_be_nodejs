import pool from '../../config/db';
import { InventoryImportDetail } from '../types/inventory_import_details.type';

export type CreateInventoryImportDetailInput = Pick<InventoryImportDetail, 'import_id' | 'product_id' | 'quantity' | 'import_price'>;

export const findInventoryImportDetailById = async (id: number): Promise<InventoryImportDetail | null> => {
  const result = await pool.query('SELECT * FROM inventory_import_details WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllInventoryImportDetails = async (): Promise<InventoryImportDetail[]> => {
  const result = await pool.query('SELECT * FROM inventory_import_details');
  return result.rows;
};

export const createInventoryImportDetail = async (data: CreateInventoryImportDetailInput): Promise<InventoryImportDetail> => {
  const { import_id, product_id, quantity, import_price } = data;
  const result = await pool.query(
    `INSERT INTO inventory_import_details (import_id, product_id, quantity, import_price) VALUES ($1, $2, $3, $4) RETURNING *`,
    [import_id, product_id, quantity, import_price]
  );
  return result.rows[0];
};

export const updateInventoryImportDetail = async (
  id: number,
  data: Partial<CreateInventoryImportDetailInput>
): Promise<InventoryImportDetail | null> => {
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
    `UPDATE inventory_import_details SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteInventoryImportDetail = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM inventory_import_details WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
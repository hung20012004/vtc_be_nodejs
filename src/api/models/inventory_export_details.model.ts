import pool from '../../config/db';
import { InventoryExportDetail } from '../types/inventory_export_details.type';

export type CreateInventoryExportDetailInput = Pick<InventoryExportDetail, 'export_id' | 'product_id' | 'quantity'>;

export const findInventoryExportDetailById = async (id: number): Promise<InventoryExportDetail | null> => {
  const result = await pool.query('SELECT * FROM inventory_export_details WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllInventoryExportDetails = async (): Promise<InventoryExportDetail[]> => {
  const result = await pool.query('SELECT * FROM inventory_export_details');
  return result.rows;
};

export const createInventoryExportDetail = async (data: CreateInventoryExportDetailInput): Promise<InventoryExportDetail> => {
  const { export_id, product_id, quantity } = data;
  const result = await pool.query(
    `INSERT INTO inventory_export_details (export_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *`,
    [export_id, product_id, quantity]
  );
  return result.rows[0];
};

export const updateInventoryExportDetail = async (
  id: number,
  data: Partial<CreateInventoryExportDetailInput>
): Promise<InventoryExportDetail | null> => {
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
    `UPDATE inventory_export_details SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteInventoryExportDetail = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM inventory_export_details WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
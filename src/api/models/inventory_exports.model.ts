import pool from '../../config/db';
import { InventoryExport } from '../types/inventory_exports.type';

export type CreateInventoryExportInput = Pick<InventoryExport, 'export_code' | 'export_date' | 'reason' | 'status' | 'created_by'>;

export const findInventoryExportById = async (id: number): Promise<InventoryExport | null> => {
  const result = await pool.query('SELECT * FROM inventory_exports WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllInventoryExports = async (): Promise<InventoryExport[]> => {
  const result = await pool.query('SELECT * FROM inventory_exports');
  return result.rows;
};

export const createInventoryExport = async (data: CreateInventoryExportInput): Promise<InventoryExport> => {
  const { export_code, export_date, reason, status, created_by } = data;
  const result = await pool.query(
    `INSERT INTO inventory_exports (export_code, export_date, reason, status, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [export_code, export_date, reason, status, created_by]
  );
  return result.rows[0];
};

export const updateInventoryExport = async (
  id: number,
  data: Partial<CreateInventoryExportInput>
): Promise<InventoryExport | null> => {
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
    `UPDATE inventory_exports SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteInventoryExport = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM inventory_exports WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
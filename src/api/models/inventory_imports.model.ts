import pool from '../../config/db';
import { InventoryImport } from '../types/inventory_imports.type';

export type CreateInventoryImportInput = Pick<InventoryImport, 'import_code' | 'supplier_id' | 'import_date' | 'total_amount' | 'status' | 'created_by'>;

export const findInventoryImportById = async (id: number): Promise<InventoryImport | null> => {
  const result = await pool.query('SELECT * FROM inventory_imports WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllInventoryImports = async (): Promise<InventoryImport[]> => {
  const result = await pool.query('SELECT * FROM inventory_imports');
  return result.rows;
};

export const createInventoryImport = async (data: CreateInventoryImportInput): Promise<InventoryImport> => {
  const { import_code, supplier_id, import_date, total_amount, status, created_by } = data;
  const result = await pool.query(
    `INSERT INTO inventory_imports (import_code, supplier_id, import_date, total_amount, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [import_code, supplier_id, import_date, total_amount, status, created_by]
  );
  return result.rows[0];
};

export const updateInventoryImport = async (
  id: number,
  data: Partial<CreateInventoryImportInput>
): Promise<InventoryImport | null> => {
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
    `UPDATE inventory_imports SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteInventoryImport = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM inventory_imports WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
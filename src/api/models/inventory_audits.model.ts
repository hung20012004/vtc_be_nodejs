import pool from '../../config/db';
import { InventoryAudit } from '../types/inventory_audits.type';

export type CreateInventoryAuditInput = Pick<InventoryAudit, 'product_id' | 'audit_date' | 'expected_quantity' | 'actual_quantity' | 'difference' | 'user_id' | 'notes'>;

export const findInventoryAuditById = async (id: number): Promise<InventoryAudit | null> => {
  const result = await pool.query('SELECT * FROM inventory_audits WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllInventoryAudits = async (): Promise<InventoryAudit[]> => {
  const result = await pool.query('SELECT * FROM inventory_audits');
  return result.rows;
};

export const createInventoryAudit = async (data: CreateInventoryAuditInput): Promise<InventoryAudit> => {
  const { product_id, audit_date, expected_quantity, actual_quantity, difference, user_id, notes } = data;
  const result = await pool.query(
    `INSERT INTO inventory_audits (product_id, audit_date, expected_quantity, actual_quantity, difference, user_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [product_id, audit_date, expected_quantity, actual_quantity, difference, user_id, notes]
  );
  return result.rows[0];
};

export const updateInventoryAudit = async (
  id: number,
  data: Partial<CreateInventoryAuditInput>
): Promise<InventoryAudit | null> => {
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
    `UPDATE inventory_audits SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteInventoryAudit = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM inventory_audits WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
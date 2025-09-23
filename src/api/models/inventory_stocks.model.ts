import pool from '../../config/db';
import { InventoryStock } from '../types/inventory_stocks.type';

export type CreateInventoryStockInput = Pick<InventoryStock, 'product_id' | 'available_quantity' | 'updated_at'>;

export const findInventoryStockById = async (id: number): Promise<InventoryStock | null> => {
  const result = await pool.query('SELECT * FROM inventory_stocks WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllInventoryStocks = async (): Promise<InventoryStock[]> => {
  const result = await pool.query('SELECT * FROM inventory_stocks');
  return result.rows;
};

export const createInventoryStock = async (data: CreateInventoryStockInput): Promise<InventoryStock> => {
  const { product_id, available_quantity, updated_at } = data;
  const result = await pool.query(
    `INSERT INTO inventory_stocks (product_id, available_quantity, updated_at) VALUES ($1, $2, $3) RETURNING *`,
    [product_id, available_quantity, updated_at]
  );
  return result.rows[0];
};

export const updateInventoryStock = async (
  id: number,
  data: Partial<CreateInventoryStockInput>
): Promise<InventoryStock | null> => {
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
    `UPDATE inventory_stocks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteInventoryStock = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM inventory_stocks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
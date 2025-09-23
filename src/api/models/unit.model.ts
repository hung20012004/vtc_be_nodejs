import pool from '../../config/db';
import { Unit } from '../types/unit.type';

export type CreateUnitInput = Pick<Unit, 'name' | 'symbol'>;

export const findUnitById = async (id: number): Promise<Unit | null> => {
  const result = await pool.query('SELECT * FROM units WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllUnits = async (): Promise<Unit[]> => {
  const result = await pool.query('SELECT * FROM units');
  return result.rows;
};

export const createUnit = async (data: CreateUnitInput): Promise<Unit> => {
  const { name, symbol } = data;
  const result = await pool.query(
    `INSERT INTO units (name, symbol) VALUES ($1, $2) RETURNING *`,
    [name, symbol]
  );
  return result.rows[0];
};

export const updateUnit = async (
  id: number,
  data: Partial<CreateUnitInput>
): Promise<Unit | null> => {
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
    `UPDATE units SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteUnit = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM units WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
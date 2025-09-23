import pool from '../../config/db';
import { Migration } from '../types/migrations.type';

export const findMigrationById = async (id: number): Promise<Migration | null> => {
  const result = await pool.query('SELECT * FROM migrations WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllMigrations = async (): Promise<Migration[]> => {
  const result = await pool.query('SELECT * FROM migrations');
  return result.rows;
};

export const createMigration = async (data: Migration): Promise<Migration> => {
  const { migration, batch } = data;
  const result = await pool.query(
    `INSERT INTO migrations (migration, batch) VALUES ($1, $2) RETURNING *`,
    [migration, batch]
  );
  return result.rows[0];
};

export const updateMigration = async (
  id: number,
  data: Partial<Omit<Migration, 'id'>>
): Promise<Migration | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const k in data) {
    fields.push(`${k} = $${idx}`);
    values.push((data as any)[k]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE migrations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteMigration = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM migrations WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
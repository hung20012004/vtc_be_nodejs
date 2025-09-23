import pool from '../../config/db';
import { Setting } from '../types/settings.type';

export const findSettingByKey = async (key: string): Promise<Setting | null> => {
  const result = await pool.query('SELECT * FROM settings WHERE key = $1', [key]);
  return result.rows[0] || null;
};

export const getAllSettings = async (): Promise<Setting[]> => {
  const result = await pool.query('SELECT * FROM settings');
  return result.rows;
};

export const createSetting = async (data: Setting): Promise<Setting> => {
  const { key, value } = data;
  const result = await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) RETURNING *`,
    [key, value]
  );
  return result.rows[0];
};

export const updateSetting = async (
  key: string,
  data: Partial<Omit<Setting, 'key'>>
): Promise<Setting | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const k in data) {
    fields.push(`${k} = $${idx}`);
    values.push((data as any)[k]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(key);
  const result = await pool.query(
    `UPDATE settings SET ${fields.join(', ')} WHERE key = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteSetting = async (key: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM settings WHERE key = $1', [key]);
  return (result.rowCount ?? 0) > 0;
};
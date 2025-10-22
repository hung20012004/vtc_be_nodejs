import pool from '../../../config/db';
import { Ward } from '../../types/locations/wards.type';

export const findWardByCode = async (code: string): Promise<Ward | null> => {
  const result = await pool.query('SELECT * FROM wards WHERE code = $1', [code]);
  return result.rows[0] || null;
};

export const getAllWards = async (): Promise<Ward[]> => {
  const result = await pool.query('SELECT * FROM wards');
  return result.rows;
};

export const createWard = async (data: Ward): Promise<Ward> => {
  const { code, name, name_en, full_name, full_name_en, code_name, district_code } = data;
  const result = await pool.query(
    `INSERT INTO wards (code, name, name_en, full_name, full_name_en, code_name, district_code) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [code, name, name_en, full_name, full_name_en, code_name, district_code]
  );
  return result.rows[0];
};

export const updateWard = async (
  code: string,
  data: Partial<Omit<Ward, 'code'>>
): Promise<Ward | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key in data) {
    fields.push(`${key} = $${idx}`);
    values.push((data as any)[key]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(code);
  const result = await pool.query(
    `UPDATE wards SET ${fields.join(', ')} WHERE code = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteWard = async (code: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM wards WHERE code = $1', [code]);
  return (result.rowCount ?? 0) > 0;
};
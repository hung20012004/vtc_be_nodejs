import pool from '../../config/db';
import { Province } from '../types/provinces.type';

export const findProvinceByCode = async (code: string): Promise<Province | null> => {
  const result = await pool.query('SELECT * FROM provinces WHERE code = $1', [code]);
  return result.rows[0] || null;
};

export const getAllProvinces = async (): Promise<Province[]> => {
  const result = await pool.query('SELECT * FROM provinces');
  return result.rows;
};

export const createProvince = async (data: Province): Promise<Province> => {
  const { code, name, name_en, full_name, full_name_en, code_name } = data;
  const result = await pool.query(
    `INSERT INTO provinces (code, name, name_en, full_name, full_name_en, code_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [code, name, name_en, full_name, full_name_en, code_name]
  );
  return result.rows[0];
};

export const updateProvince = async (
  code: string,
  data: Partial<Omit<Province, 'code'>>
): Promise<Province | null> => {
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
    `UPDATE provinces SET ${fields.join(', ')} WHERE code = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteProvince = async (code: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM provinces WHERE code = $1', [code]);
  return (result.rowCount ?? 0) > 0;
};
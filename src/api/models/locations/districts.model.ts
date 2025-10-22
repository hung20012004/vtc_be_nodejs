import pool from '../../../config/db';
import { District } from '../../types/locations/districts.type';

export const findDistrictByCode = async (code: string): Promise<District | null> => {
  const result = await pool.query('SELECT * FROM districts WHERE code = $1', [code]);
  return result.rows[0] || null;
};

export const getAllDistricts = async (): Promise<District[]> => {
  const result = await pool.query('SELECT * FROM districts');
  return result.rows;
};

export const createDistrict = async (data: District): Promise<District> => {
  const { code, name, name_en, full_name, full_name_en, code_name, province_code } = data;
  const result = await pool.query(
    `INSERT INTO districts (code, name, name_en, full_name, full_name_en, code_name, province_code) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [code, name, name_en, full_name, full_name_en, code_name, province_code]
  );
  return result.rows[0];
};

export const updateDistrict = async (
  code: string,
  data: Partial<Omit<District, 'code'>>
): Promise<District | null> => {
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
    `UPDATE districts SET ${fields.join(', ')} WHERE code = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteDistrict = async (code: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM districts WHERE code = $1', [code]);
  return (result.rowCount ?? 0) > 0;
};
import pool from '../../config/db';
import { Promotion } from '../types/promotions.type';

export type CreatePromotionInput = Pick<Promotion, 'code' | 'type' | 'value' | 'start_date' | 'end_date' | 'is_active'>;

export const findPromotionById = async (id: number): Promise<Promotion | null> => {
  const result = await pool.query('SELECT * FROM promotions WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllPromotions = async (): Promise<Promotion[]> => {
  const result = await pool.query('SELECT * FROM promotions');
  return result.rows;
};

export const createPromotion = async (data: CreatePromotionInput): Promise<Promotion> => {
  const { code, type, value, start_date, end_date, is_active } = data;
  const result = await pool.query(
    `INSERT INTO promotions (code, type, value, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [code, type, value, start_date, end_date, is_active]
  );
  return result.rows[0];
};

export const updatePromotion = async (
  id: number,
  data: Partial<CreatePromotionInput>
): Promise<Promotion | null> => {
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
    `UPDATE promotions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deletePromotion = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM promotions WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
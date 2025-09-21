import pool from '../../config/db';
import { FAQ } from '../types/faqs.type';

export type CreateFAQInput = Pick<FAQ, 'question' | 'answer' | 'is_active' | 'sort_order'>;

export const findFAQById = async (id: number): Promise<FAQ | null> => {
  const result = await pool.query('SELECT * FROM faqs WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllFAQs = async (): Promise<FAQ[]> => {
  const result = await pool.query('SELECT * FROM faqs');
  return result.rows;
};

export const createFAQ = async (data: CreateFAQInput): Promise<FAQ> => {
  const { question, answer, is_active, sort_order } = data;
  const result = await pool.query(
    `INSERT INTO faqs (question, answer, is_active, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
    [question, answer, is_active, sort_order]
  );
  return result.rows[0];
};

export const updateFAQ = async (
  id: number,
  data: Partial<CreateFAQInput>
): Promise<FAQ | null> => {
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
    `UPDATE faqs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteFAQ = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM faqs WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
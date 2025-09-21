import pool from '../../config/db';
import { Category } from '../types/categories.type';

export type CreateCategoryInput = Pick<Category, 'name' | 'slug' | 'parent_id' | 'is_active'>;

export const findCategoryById = async (id: number): Promise<Category | null> => {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllCategories = async (): Promise<Category[]> => {
  const result = await pool.query('SELECT * FROM categories');
  return result.rows;
};

export const createCategory = async (data: CreateCategoryInput): Promise<Category> => {
  const { name, slug, parent_id, is_active } = data;
  const result = await pool.query(
    `INSERT INTO categories (name, slug, parent_id, is_active) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, parent_id, is_active]
  );
  return result.rows[0];
};

export const updateCategory = async (
  id: number,
  data: Partial<CreateCategoryInput>
): Promise<Category | null> => {
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
    `UPDATE categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteCategory = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
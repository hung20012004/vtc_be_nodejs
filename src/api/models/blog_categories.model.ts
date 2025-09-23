import pool from '../../config/db';
import { BlogCategory } from '../types/blog_categories.type';

export type CreateBlogCategoryInput = Pick<BlogCategory, 'name' | 'slug'>;

export const findBlogCategoryById = async (id: number): Promise<BlogCategory | null> => {
  const result = await pool.query('SELECT * FROM blog_categories WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllBlogCategories = async (): Promise<BlogCategory[]> => {
  const result = await pool.query('SELECT * FROM blog_categories');
  return result.rows;
};

export const createBlogCategory = async (data: CreateBlogCategoryInput): Promise<BlogCategory> => {
  const { name, slug } = data;
  const result = await pool.query(
    `INSERT INTO blog_categories (name, slug) VALUES ($1, $2) RETURNING *`,
    [name, slug]
  );
  return result.rows[0];
};

export const updateBlogCategory = async (
  id: number,
  data: Partial<CreateBlogCategoryInput>
): Promise<BlogCategory | null> => {
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
    `UPDATE blog_categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteBlogCategory = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM blog_categories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
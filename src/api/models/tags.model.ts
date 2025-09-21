import pool from '../../config/db';
import { Tag } from '../types/tags.type';

export type CreateTagInput = Pick<Tag, 'name' | 'slug'>;

export const findTagById = async (id: number): Promise<Tag | null> => {
  const result = await pool.query('SELECT * FROM tags WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllTags = async (): Promise<Tag[]> => {
  const result = await pool.query('SELECT * FROM tags');
  return result.rows;
};

export const createTag = async (data: CreateTagInput): Promise<Tag> => {
  const { name, slug } = data;
  const result = await pool.query(
    `INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING *`,
    [name, slug]
  );
  return result.rows[0];
};

export const updateTag = async (
  id: number,
  data: Partial<CreateTagInput>
): Promise<Tag | null> => {
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
    `UPDATE tags SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteTag = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM tags WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
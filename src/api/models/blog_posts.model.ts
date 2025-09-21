import pool from '../../config/db';
import { BlogPost } from '../types/blog_posts.type';

export type CreateBlogPostInput = Pick<BlogPost, 'title' | 'slug' | 'content' | 'author_id' | 'category_id' | 'is_published'>;

export const findBlogPostById = async (id: number): Promise<BlogPost | null> => {
  const result = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllBlogPosts = async (): Promise<BlogPost[]> => {
  const result = await pool.query('SELECT * FROM blog_posts');
  return result.rows;
};

export const createBlogPost = async (data: CreateBlogPostInput): Promise<BlogPost> => {
  const { title, slug, content, author_id, category_id, is_published } = data;
  const result = await pool.query(
    `INSERT INTO blog_posts (title, slug, content, author_id, category_id, is_published) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, slug, content, author_id, category_id, is_published]
  );
  return result.rows[0];
};

export const updateBlogPost = async (
  id: number,
  data: Partial<CreateBlogPostInput>
): Promise<BlogPost | null> => {
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
    `UPDATE blog_posts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteBlogPost = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
import pool from '../../config/db';
import { BlogPostTag } from '../types/blog_post_tag.type';

export const findBlogPostTag = async (
  post_id: number,
  tag_id: number
): Promise<BlogPostTag | null> => {
  const result = await pool.query(
    'SELECT * FROM blog_post_tag WHERE post_id = $1 AND tag_id = $2',
    [post_id, tag_id]
  );
  return result.rows[0] || null;
};

export const getAllBlogPostTags = async (): Promise<BlogPostTag[]> => {
  const result = await pool.query('SELECT * FROM blog_post_tag');
  return result.rows;
};

export const createBlogPostTag = async (data: BlogPostTag): Promise<BlogPostTag> => {
  const { post_id, tag_id } = data;
  const result = await pool.query(
    `INSERT INTO blog_post_tag (post_id, tag_id) VALUES ($1, $2) RETURNING *`,
    [post_id, tag_id]
  );
  return result.rows[0];
};

export const deleteBlogPostTag = async (
  post_id: number,
  tag_id: number
): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM blog_post_tag WHERE post_id = $1 AND tag_id = $2',
    [post_id, tag_id]
  );
  return (result.rowCount ?? 0) > 0;
};
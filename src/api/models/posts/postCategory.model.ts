import pool from '../../../config/db';
import { PostCategory } from '../../types/posts/blog.type';

export const create = async (data: Omit<PostCategory, 'id'|'created_at'|'updated_at'>): Promise<PostCategory> => {
    const { name, slug, description, parent_id } = data;
    const result = await pool.query(
        'INSERT INTO post_categories (name, slug, description, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, slug, description, parent_id]
    );
    return result.rows[0];
};

export const findAll = async (): Promise<PostCategory[]> => {
    const result = await pool.query('SELECT * FROM post_categories ORDER BY name ASC');
    return result.rows;
};

export const findById = async (id: number): Promise<PostCategory | null> => {
    const result = await pool.query('SELECT * FROM post_categories WHERE id = $1', [id]);
    return result.rows[0] || null;
};

export const update = async (id: number, data: Partial<Omit<PostCategory, 'id'|'created_at'|'updated_at'>>): Promise<PostCategory | null> => {
    const fields = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    const values = Object.values(data);
    
    if (fields.length === 0) {
        return findById(id);
    }

    const result = await pool.query(
        `UPDATE post_categories SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
    );
    return result.rows[0] || null;
};

export const remove = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM post_categories WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
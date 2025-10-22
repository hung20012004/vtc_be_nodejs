import pool from '../../../config/db';
import { Post } from '../../types/posts/blog.type';

type PostInput = Omit<Post, 'id' | 'created_at' | 'updated_at' | 'views'> & { tags?: number[] };

export const create = async (data: PostInput, authorId: number): Promise<Post> => {
    const { tags, ...postData } = data;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const columns = Object.keys(postData);
        const values = Object.values(postData);
        const query = `
            INSERT INTO posts (${columns.join(', ')}, author_id)
            VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1})
            RETURNING *`;
        const postResult = await client.query(query, [...values, authorId]);
        const newPost = postResult.rows[0];

        if (tags && tags.length > 0) {
            for (const tagId of tags) {
                await client.query('INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)', [newPost.id, tagId]);
            }
        }
        await client.query('COMMIT');
        return newPost;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const findAll = async (limit: number, offset: number): Promise<Post[]> => {
    const query = `
        SELECT p.*, u.name as author_name, pc.name as category_name
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN post_categories pc ON p.category_id = pc.id
        ORDER BY p.published_at DESC, p.id DESC
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
};

export const findBySlug = async (slug: string): Promise<Post | null> => {
    const query = `
        SELECT p.*, u.name as author_name, pc.name as category_name,
               (SELECT json_agg(t.*) FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = p.id) as tags
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN post_categories pc ON p.category_id = pc.id
        WHERE p.slug = $1 AND p.is_published = true`;
    const result = await pool.query(query, [slug]);
    return result.rows[0] || null;
};

export const update = async (id: number, data: Partial<PostInput>): Promise<Post | null> => {
    const { tags, ...postData } = data;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fields = Object.keys(postData).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        if (fields) {
            await client.query(`UPDATE posts SET ${fields} WHERE id = $${Object.keys(postData).length + 1}`, [...Object.values(postData), id]);
        }
        if (tags) {
            await client.query('DELETE FROM post_tags WHERE post_id = $1', [id]);
            for (const tagId of tags) {
                await client.query('INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)', [id, tagId]);
            }
        }
        await client.query('COMMIT');
        const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const remove = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
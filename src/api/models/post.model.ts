// src/api/models/post.model.ts
import pool from '../../config/db';
import { Post } from '../types/post.type';

// Lấy tất cả bài viết (dành cho admin)
export const findAllPosts = async (): Promise<Post[]> => {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    return result.rows;
};

// Lấy tất cả bài viết ĐÃ XUẤT BẢN (dành cho public)
export const findAllPublishedPosts = async (): Promise<Post[]> => {
    const result = await pool.query(`
        SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.published_at, u.name as author_name, bc.name as category_name
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN blog_categories bc ON p.category_id = bc.id
        WHERE p.is_published = true AND p.published_at <= NOW()
        ORDER BY p.published_at DESC
    `);
    return result.rows;
};

// Tìm bài viết theo slug (dành cho public) và tăng lượt xem
export const findPublishedPostBySlug = async (slug: string): Promise<Post | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const postResult = await client.query(
            `SELECT p.*, u.name as author_name, bc.name as category_name
             FROM posts p
             LEFT JOIN users u ON p.author_id = u.id
             LEFT JOIN blog_categories bc ON p.category_id = bc.id
             WHERE p.slug = $1 AND p.is_published = true`, [slug]);
        
        if (postResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        await client.query('UPDATE posts SET views = views + 1 WHERE slug = $1', [slug]);
        await client.query('COMMIT');
        return postResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Tìm bài viết theo ID (dành cho admin)
export const findPostById = async (id: number): Promise<Post | null> => {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

// Tạo bài viết mới (dành cho admin)
export const createPost = async (data: Partial<Post>, authorId: number, tagIds: number[] = []): Promise<Post> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { title, slug, content, category_id, is_published, excerpt, featured_image, seo_title, seo_description } = data;
        const published_at = is_published ? new Date() : null;
        
        const postResult = await client.query(
            `INSERT INTO posts (title, slug, content, category_id, author_id, is_published, published_at, excerpt, featured_image, seo_title, seo_description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [title, slug, content, category_id, authorId, is_published, published_at, excerpt, featured_image, seo_title, seo_description]
        );
        const newPost = postResult.rows[0];

        if (tagIds && tagIds.length > 0) {
            const tagValues = tagIds.map(tagId => `(${newPost.id}, ${tagId})`).join(',');
            await client.query(`INSERT INTO blog_post_tag (post_id, tag_id) VALUES ${tagValues}`);
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

// Cập nhật bài viết (dành cho admin)
export const updatePost = async (id: number, data: Partial<Post>, tagIds?: number[]): Promise<Post | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
        if (fields.length > 0) {
            const values = Object.values(data);
            const query = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
            await client.query(query, [...values, id]);
        }
        
        if (tagIds !== undefined) {
            await client.query('DELETE FROM blog_post_tag WHERE post_id = $1', [id]);
            if (tagIds.length > 0) {
                const tagValues = tagIds.map(tagId => `(${id}, ${tagId})`).join(',');
                await client.query(`INSERT INTO blog_post_tag (post_id, tag_id) VALUES ${tagValues}`);
            }
        }
        
        await client.query('COMMIT');
        
        const updatedPost = await client.query('SELECT * FROM posts WHERE id = $1', [id]);
        return updatedPost.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Xóa bài viết (dành cho admin)
export const deletePost = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
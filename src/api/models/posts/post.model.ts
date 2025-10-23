import pool from '../../../config/db';
import { Post } from '../../types/posts/blog.type'; // Đảm bảo đường dẫn đúng

type PostInput = Omit<Post, 'id' | 'created_at' | 'updated_at' | 'views'> & { tags?: number[] };

export const create = async (data: PostInput, authorId: number): Promise<Post> => {
    const { tags, ...postData } = data;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const columns = Object.keys(postData);
        const values = Object.values(postData);
        // [SỬA ĐỔI] Thêm xử lý giá trị JSON (cho an toàn)
        const finalValues = values.map(val => (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val);

        const query = `
            INSERT INTO posts (${columns.join(', ')}, author_id)
            VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1})
            RETURNING *`;
        const postResult = await client.query(query, [...finalValues, authorId]);
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
    // ... (Hàm này giữ nguyên, không thay đổi)
    const query = `
        SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.is_published, p.published_at, 
               u.name as author_name, pc.name as category_name
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN post_categories pc ON p.category_id = pc.id
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
};

export const findBySlug = async (slug: string): Promise<Post | null> => {
    // ... (Hàm này giữ nguyên, không thay đổi)
    const query = `
        SELECT p.*, u.name as author_name, pc.name as category_name,
               (SELECT json_agg(t.*) FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = p.id) as tags
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN post_categories pc ON p.category_id = pc.id
        WHERE p.slug = $1 AND p.is_published = true`; // Chỉ lấy bài đã xuất bản
    const result = await pool.query(query, [slug]);
    if (result.rows.length > 0) {
        // Tăng lượt xem
        await pool.query('UPDATE posts SET views = views + 1 WHERE slug = $1', [slug]);
    }
    return result.rows[0] || null;
};

/**
 * [HÀM MỚI] Tìm bài viết theo ID cho Admin (không kiểm tra is_published).
 */
export const findPostById = async (id: number): Promise<Post | null> => {
    const query = `
        SELECT p.*, u.name as author_name, pc.name as category_name,
               (SELECT json_agg(t.id) FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = p.id) as tags
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN post_categories pc ON p.category_id = pc.id
        WHERE p.id = $1`; // Chỉ tìm theo ID
    const result = await pool.query(query, [id]);
    
    // Chuyển mảng tags từ [null] thành [] nếu không có tag
    if (result.rows[0] && result.rows[0].tags && result.rows[0].tags.length === 1 && result.rows[0].tags[0] === null) {
        result.rows[0].tags = [];
    }
    return result.rows[0] || null;
};


export const update = async (id: number, data: Partial<PostInput>): Promise<Post | null> => {
    const { tags, ...postData } = data;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fields = Object.keys(postData).map((key, i) => {
            const value = (postData as any)[key];
            // [SỬA ĐỔI] Thêm xử lý JSON
            if (typeof value === 'object' && value !== null) {
                return `"${key}" = $${i + 1}::jsonb`;
            }
            return `"${key}" = $${i + 1}`;
        }).join(', ');
        
        const values = Object.values(postData).map(val => (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val);

        if (fields) {
            await client.query(`UPDATE posts SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]);
        }

        if (tags) { // tags là một mảng các ID: [1, 2, 3]
            await client.query('DELETE FROM post_tags WHERE post_id = $1', [id]);
            for (const tagId of tags) {
                await client.query('INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)', [id, tagId]);
            }
        }
        await client.query('COMMIT');
        
        // Gọi hàm findPostById mới để trả về dữ liệu đầy đủ
        const updatedPost = await findPostById(id); 
        return updatedPost;
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

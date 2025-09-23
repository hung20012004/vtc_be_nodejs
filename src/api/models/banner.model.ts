// src/api/models/banner.model.ts
import pool from '../../config/db';
import { Banner } from '../types/banner.type';

export type CreateBannerInput = Omit<Banner, 'id' | 'created_at' | 'updated_at' | 'click_count' | 'view_count'>;
export type UpdateBannerInput = Partial<CreateBannerInput>;

// Dành cho public: Lấy các banner đang hoạt động và trong thời gian hiệu lực
export const findActiveBannersByPosition = async (position: string): Promise<Banner[]> => {
    const result = await pool.query(
        `SELECT * FROM banners
         WHERE position = $1 AND is_active = true
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())
         ORDER BY sort_order ASC`,
        [position]
    );
    return result.rows;
};

// Dành cho admin: Lấy tất cả banners
export const findAllBanners = async (): Promise<Banner[]> => {
    const result = await pool.query('SELECT * FROM banners ORDER BY position, sort_order ASC');
    return result.rows;
};

export const findBannerById = async (id: number): Promise<Banner | null> => {
    const result = await pool.query('SELECT * FROM banners WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const createBanner = async (data: CreateBannerInput): Promise<Banner> => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO banners (${columns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
};

export const updateBanner = async (id: number, data: UpdateBannerInput): Promise<Banner | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findBannerById(id);
    const values = Object.values(data);
    const query = `UPDATE banners SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteBanner = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
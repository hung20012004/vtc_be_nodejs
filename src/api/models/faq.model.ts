// src/api/models/faq.model.ts
import pool from '../../config/db';
import { Faq } from '../types/faq.type';

export type CreateFaqInput = Omit<Faq, 'id' | 'created_at' | 'updated_at' | 'views' | 'created_by'>;
export type UpdateFaqInput = Partial<CreateFaqInput>;

// Public: Lấy các FAQ đang hoạt động
export const findActiveFaqs = async (): Promise<Faq[]> => {
    const result = await pool.query(
        'SELECT * FROM faqs WHERE is_active = true ORDER BY category, sort_order ASC'
    );
    return result.rows;
};

// Admin: Lấy tất cả FAQ
export const findAllFaqs = async (): Promise<Faq[]> => {
    const result = await pool.query('SELECT * FROM faqs ORDER BY category, sort_order ASC');
    return result.rows;
};

export const findFaqById = async (id: number): Promise<Faq | null> => {
    const result = await pool.query('SELECT * FROM faqs WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const createFaq = async (data: CreateFaqInput, createdBy: number): Promise<Faq> => {
    const { question, answer, category, sort_order, is_active } = data;
    const result = await pool.query(
        'INSERT INTO faqs (question, answer, category, sort_order, is_active, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [question, answer, category, sort_order, is_active, createdBy]
    );
    return result.rows[0];
};

export const updateFaq = async (id: number, data: UpdateFaqInput): Promise<Faq | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findFaqById(id);
    const values = Object.values(data);
    const query = `UPDATE faqs SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteFaq = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM faqs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
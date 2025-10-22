// src/api/models/setting.model.ts
import pool from '../../../config/db';
import { Setting } from '../../types/settings/setting.type';

// Lấy tất cả cài đặt (dành cho admin)
export const findAllSettings = async (): Promise<Setting[]> => {
    const result = await pool.query('SELECT * FROM settings ORDER BY "group", id');
    return result.rows;
};

// Lấy các cài đặt công khai (dành cho public)
export const findPublicSettings = async (): Promise<Setting[]> => {
    const publicGroups = ['general', 'social']; // Chỉ lấy các nhóm cài đặt an toàn
    const result = await pool.query('SELECT key, value FROM settings WHERE "group" = ANY($1::text[])', [publicGroups]);
    return result.rows;
};

// Cập nhật nhiều cài đặt cùng lúc
export const updateSettings = async (settings: { key: string, value: string }[]): Promise<void> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const setting of settings) {
            await client.query('UPDATE settings SET value = $1 WHERE key = $2', [setting.value, setting.key]);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
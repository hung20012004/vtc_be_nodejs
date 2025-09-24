// src/api/models/token.model.ts
import pool from '../../config/db';
import { PersonalAccessToken } from '../types/token.type';

// Lấy danh sách token của một user (không bao gồm token thật)
export const findTokensByUserId = async (userId: number): Promise<Omit<PersonalAccessToken, 'token'>[]> => {
    const result = await pool.query(
        'SELECT id, name, abilities, last_used_at, expires_at, created_at FROM personal_access_tokens WHERE tokenable_type = $1 AND tokenable_id = $2',
        ['User', userId]
    );
    return result.rows;
};

// Tạo một token mới
export const createToken = async (userId: number, name: string, abilities: string[], hashedToken: string): Promise<PersonalAccessToken> => {
    const result = await pool.query(
        'INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, abilities, token) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['User', userId, name, JSON.stringify(abilities), hashedToken]
    );
    return result.rows[0];
};

// Xóa một token
export const deleteToken = async (id: number, userId: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM personal_access_tokens WHERE id = $1 AND tokenable_id = $2', [id, userId]);
    return (result.rowCount ?? 0) > 0;
};
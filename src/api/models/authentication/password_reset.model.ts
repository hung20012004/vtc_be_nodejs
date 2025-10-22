// src/api/models/passwordReset.model.ts
import pool from '../../../config/db';

export const createOrUpdateResetToken = async (email: string, token: string): Promise<void> => {
    await pool.query(
        `INSERT INTO password_resets (email, token, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (email) DO UPDATE SET token = $2, created_at = NOW()`,
        [email, token]
    );
};

export const findTokenRecord = async (token: string): Promise<any | null> => {
    const result = await pool.query('SELECT * FROM password_resets WHERE token = $1', [token]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteToken = async (email: string): Promise<void> => {
    await pool.query('DELETE FROM password_resets WHERE email = $1', [email]);
};
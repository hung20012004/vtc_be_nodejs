import pool from '../../config/db';
import { PasswordReset } from '../types/password_resets.type';

export const findPasswordResetByEmail = async (email: string): Promise<PasswordReset | null> => {
  const result = await pool.query('SELECT * FROM password_resets WHERE email = $1', [email]);
  return result.rows[0] || null;
};

export const getAllPasswordResets = async (): Promise<PasswordReset[]> => {
  const result = await pool.query('SELECT * FROM password_resets');
  return result.rows;
};

export const createPasswordReset = async (data: PasswordReset): Promise<PasswordReset> => {
  const { email, token, created_at } = data;
  const result = await pool.query(
    `INSERT INTO password_resets (email, token, created_at) VALUES ($1, $2, $3) RETURNING *`,
    [email, token, created_at]
  );
  return result.rows[0];
};

export const deletePasswordReset = async (email: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM password_resets WHERE email = $1', [email]);
  return (result.rowCount ?? 0) > 0;
};
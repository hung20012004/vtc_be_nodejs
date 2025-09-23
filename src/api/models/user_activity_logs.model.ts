import pool from '../../config/db';
import { UserActivityLog } from '../types/user_activity_logs.type';

export type CreateUserActivityLogInput = Pick<UserActivityLog, 'user_id' | 'action' | 'details' | 'ip'|'user_agent'>;

export const findUserActivityLogById = async (id: number): Promise<UserActivityLog | null> => {
  const result = await pool.query('SELECT * FROM user_activity_logs WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllUserActivityLogs = async (): Promise<UserActivityLog[]> => {
  const result = await pool.query('SELECT * FROM user_activity_logs');
  return result.rows;
};

export const createUserActivityLog = async (data: CreateUserActivityLogInput): Promise<UserActivityLog> => {
  const { user_id, action, details, ip, user_agent } = data;
  const result = await pool.query(
    `INSERT INTO user_activity_logs (user_id, action, description, created_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [user_id, action, details, ip, user_agent]
  );
  return result.rows[0];
};

export const updateUserActivityLog = async (
  id: number,
  data: Partial<CreateUserActivityLogInput>
): Promise<UserActivityLog | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key in data) {
    fields.push(`${key} = $${idx}`);
    values.push((data as any)[key]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE user_activity_logs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteUserActivityLog = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM user_activity_logs WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
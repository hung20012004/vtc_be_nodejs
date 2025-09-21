import pool from '../../config/db';
import { PersonalAccessToken } from '../types/personal_access_tokens.type';

export const findPersonalAccessTokenById = async (id: number): Promise<PersonalAccessToken | null> => {
  const result = await pool.query('SELECT * FROM personal_access_tokens WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllPersonalAccessTokens = async (): Promise<PersonalAccessToken[]> => {
  const result = await pool.query('SELECT * FROM personal_access_tokens');
  return result.rows;
};

export const createPersonalAccessToken = async (data: PersonalAccessToken): Promise<PersonalAccessToken> => {
  const { tokenable_type, tokenable_id, name, token, abilities, last_used_at, created_at, updated_at } = data;
  const result = await pool.query(
    `INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, last_used_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [tokenable_type, tokenable_id, name, token, abilities, last_used_at, created_at, updated_at]
  );
  return result.rows[0];
};

export const deletePersonalAccessToken = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM personal_access_tokens WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
import pool from '../../config/db';
import { Role } from '../types/roles.type';

export type CreateRoleInput = Pick<Role, 'name' | 'slug' >;

/**
 * Tìm kiếm role theo ID.
 */
export const findRoleById = async (id: number): Promise<Role | null> => {
  const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
  return result.rows[0] || null;
};

/**
 * Lấy tất cả role.
 */
export const getAllRoles = async (): Promise<Role[]> => {
  const result = await pool.query('SELECT * FROM roles');
  return result.rows;
};

/**
 * Tạo role mới.
 */
export const createRole = async (data: CreateRoleInput): Promise<Role> => {
  const { name, slug } = data;
  const result = await pool.query(
    `INSERT INTO roles (name, slug) VALUES ($1, $2, $3) RETURNING *`,
    [name, slug]
  );
  return result.rows[0];
};

/**
 * Cập nhật role theo ID.
 */
export const updateRole = async (
  id: number,
  data: Partial<CreateRoleInput>
): Promise<Role | null> => {
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
    `UPDATE roles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

/**
 * Xóa role theo ID.
 */
export const deleteRole = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM roles WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
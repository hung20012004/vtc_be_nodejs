import pool from '../../config/db';
import { PermissionRole } from '../types/permission_role.type';

/**
 * Tìm kiếm một permission_role theo permission_id và role_id.
 */
export const findPermissionRole = async (
  permission_id: number,
  role_id: number
): Promise<PermissionRole | null> => {
  const result = await pool.query(
    'SELECT * FROM permission_role WHERE permission_id = $1 AND role_id = $2',
    [permission_id, role_id]
  );
  return result.rows[0] || null;
};

/**
 * Lấy tất cả permission_role.
 */
export const getAllPermissionRoles = async (): Promise<PermissionRole[]> => {
  const result = await pool.query('SELECT * FROM permission_role');
  return result.rows;
};

/**
 * Tạo mới một permission_role.
 */
export const createPermissionRole = async (
  data: PermissionRole
): Promise<PermissionRole> => {
  const { permission_id, role_id } = data;
  const result = await pool.query(
    `INSERT INTO permission_role (permission_id, role_id) VALUES ($1, $2) RETURNING *`,
    [permission_id, role_id]
  );
  return result.rows[0];
};

/**
 * Xóa một permission_role.
 */
export const deletePermissionRole = async (
  permission_id: number,
  role_id: number
): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM permission_role WHERE permission_id = $1 AND role_id = $2',
    [permission_id, role_id]
  );
  return (result.rowCount ?? 0) > 0;
};
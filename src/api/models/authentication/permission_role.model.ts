// src/api/models/permissionRole.model.ts

import pool from '../../../config/db';
import { Permission } from '../../types/authentication/permission.type';

/**
 * Gán một quyền cho một vai trò.
 * @param roleId ID của vai trò
 * @param permissionId ID của quyền
 */
export const assignPermissionToRole = async (roleId: number, permissionId: number): Promise<void> => {
  // Dùng ON CONFLICT DO NOTHING để tránh lỗi nếu đã tồn tại cặp key này
  await pool.query(
    'INSERT INTO permission_role (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [roleId, permissionId]
  );
};

/**
 * Thu hồi một quyền khỏi một vai trò.
 * @param roleId ID của vai trò
 * @param permissionId ID của quyền
 */
export const revokePermissionFromRole = async (roleId: number, permissionId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM permission_role WHERE role_id = $1 AND permission_id = $2',
    [roleId, permissionId]
  );
  return (result.rowCount ?? 0) > 0;
};

/**
 * Lấy danh sách tất cả các quyền của một vai trò cụ thể.
 * @param roleId ID của vai trò
 * @returns Mảng các đối tượng Permission
 */
export const getPermissionsByRoleId = async (roleId: number): Promise<Permission[]> => {
  const result = await pool.query(
    `SELECT p.* FROM permissions p
     JOIN permission_role pr ON p.id = pr.permission_id
     WHERE pr.role_id = $1`,
    [roleId]
  );
  return result.rows;
};
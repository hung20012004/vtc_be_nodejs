import pool from '../../../config/db';
import { Permission } from '../../types/authentication/permission.type';

export type CreatePermissionInput = Pick<Permission, 'name' | 'slug'>;

export const findPermissionById = async (id: number): Promise<Permission | null> => {
  const result = await pool.query('SELECT * FROM permissions WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllPermissions = async (): Promise<Permission[]> => {
  const result = await pool.query('SELECT * FROM permissions');
  return result.rows;
};

export const createPermission = async (data: CreatePermissionInput): Promise<Permission> => {
  const { name, slug } = data;
  const result = await pool.query(
    `INSERT INTO permissions (name, slug) VALUES ($1, $2) RETURNING *`,
    [name, slug]
  );
  return result.rows[0];
};

export const updatePermission = async (
  id: number,
  data: Partial<CreatePermissionInput>
): Promise<Permission | null> => {
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
    `UPDATE permissions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deletePermission = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM permissions WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
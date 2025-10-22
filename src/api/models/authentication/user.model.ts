// src/api/models/user.model.ts

import pool from '../../../config/db';
import { User } from '../../types/authentication/user.type';
import { PoolClient } from 'pg';
// Kiểu dữ liệu cho việc tạo người dùng mới, chỉ bao gồm các trường cần thiết khi đăng ký.
export type CreateUserInput = Pick<User, 'name' | 'email' | 'password'> & {
    role_id?: number;
    user_type?: number;
    status?: number;
    verification_token?: string;
    verification_token_expires?: Date;
    branch_id?: number;
};

/**
 * Tìm người dùng bằng email. Trả về tất cả các trường.
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Tìm người dùng bằng ID. Không trả về mật khẩu.
 */
export const findUserById = async (id: number): Promise<Omit<User, 'password'> | null> => {
  const result = await pool.query(
    'SELECT id, name, email, phone, role_id, avatar, status, user_type, branch_id, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy tất cả người dùng. Không trả về mật khẩu.
 */
export const getAllUsers = async (): Promise<Omit<User, 'password'>[]> => {
  const result = await pool.query(
    'SELECT id, name, email, phone, role_id, avatar, status, user_type, branch_id, created_at, updated_at FROM users'
  );
  return result.rows;
};

/**
 * Tạo người dùng mới.
 */
export const createUser = async (userData: CreateUserInput, client?: PoolClient): Promise<Pick<User, 'id' | 'name' | 'email' | 'role_id'>> => {
    // 2. Dùng client nếu được cung cấp, nếu không thì dùng pool chung
    const db = client || pool;

    const { name, email, password, role_id, user_type, status, verification_token, verification_token_expires, branch_id } = userData;
    
    // 3. Sử dụng 'db' thay vì 'pool' để thực hiện query
    const result = await db.query(
        `INSERT INTO users (name, email, password, role_id, user_type, status, verification_token, verification_token_expires, branch_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9)
         RETURNING id, name, email, role_id`,
        [name, email, password, role_id, user_type, status, verification_token, verification_token_expires,branch_id]
    );
    
    return result.rows[0];
};

/**
 * Cập nhật thông tin người dùng.
 */
export const updateUser = async (
  id: number,
  data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at' | 'password'>>
): Promise<Omit<User, 'password'> | null> => {
  const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
  const values = Object.values(data);
  if (fields.length === 0) return findUserById(id); // Trả về user hiện tại nếu không có gì thay đổi

  const query = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING id, name, email, phone, role_id, address, avatar, status, user_type`;
  const result = await pool.query(query, [...values, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Xóa người dùng.
 */
export const deleteUser = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
/**
 * Cập nhật mật khẩu của người dùng bằng email.
 */
export const updatePasswordByEmail = async (email: string, hashedPassword: string): Promise<boolean> => {
    const result = await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, email]
    );
    return (result.rowCount ?? 0) > 0;
};
/**
 * Xóa mềm người dùng bằng cách cập nhật trường `deleted_at`.
 */
export const softDeleteUser = async (id: number): Promise<boolean> => {
    const result = await pool.query(
        'UPDATE users SET deleted_at = NOW(), status = 2 WHERE id = $1 AND deleted_at IS NULL', // status = 2: Bị khóa
        [id]
    );
    return (result.rowCount ?? 0) > 0;
};
// Thêm hàm mới để tìm user bằng token
export const findUserByVerificationToken = async (token: string) => {
    const result = await pool.query('SELECT * FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()', [token]);
    return result.rows[0] || null;
};

// Thêm hàm mới để kích hoạt tài khoản
export const activateUser = async (id: number) => {
    await pool.query(
        'UPDATE users SET status = 1, email_verified_at = NOW(), verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
        [id]
    );
};
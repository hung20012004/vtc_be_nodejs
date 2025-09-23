// src/api/models/user.model.ts

import pool from '../../config/db';
import { User } from '../types/user.type';

// Kiểu dữ liệu cho việc tạo người dùng mới, chỉ bao gồm các trường cần thiết khi đăng ký.
export type CreateUserInput = Pick<User, 'name' | 'email' | 'password' | 'role_id' | 'user_type' | 'status'>;

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
    'SELECT id, name, email, phone, role_id, address, avatar, status, user_type, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy tất cả người dùng. Không trả về mật khẩu.
 */
export const getAllUsers = async (): Promise<Omit<User, 'password'>[]> => {
  const result = await pool.query(
    'SELECT id, name, email, phone, role_id, address, avatar, status, user_type, created_at, updated_at FROM users'
  );
  return result.rows;
};

/**
 * Tạo người dùng mới.
 */
export const createUser = async (userData: CreateUserInput): Promise<Pick<User, 'id' | 'name' | 'email' | 'role_id'>> => {
  const { name, email, password, role_id, user_type, status } = userData;
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role_id, user_type, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role_id`,
    [name, email, password, role_id, user_type, status]
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
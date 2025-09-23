import pool from '../../config/db';
import { User } from '../types/user.type';

export type CreateUserInput = Pick<User, 'name' | 'email' | 'password' | 'role_id' | 'user_type' | 'status'>;

/**
 * Tìm kiếm một người dùng trong database bằng địa chỉ email.
 * Trả về toàn bộ thông tin của người dùng (bao gồm cả password hash).
 * @param email - Địa chỉ email của người dùng cần tìm.
 * @returns Toàn bộ đối tượng User hoặc null nếu không tìm thấy.
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  return null;
};

/**
 * Tìm kiếm một người dùng trong database bằng ID.
 * Chỉ trả về các thông tin an toàn, không bao gồm mật khẩu.
 * @param id - ID của người dùng cần tìm.
 * @returns Một phần đối tượng User (không có password) hoặc null.
 */
export const findUserById = async (id: number): Promise<Omit<User, 'password'> | null> => {
    const result = await pool.query(
        'SELECT id, name, email, phone, role_id, address, avatar, status, user_type, created_at, updated_at FROM users WHERE id = $1',
        [id]
    );
    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return null;
}

/**
 * Tạo một người dùng mới và lưu vào database.
 * @param userData - Dữ liệu người dùng mới, tuân thủ theo kiểu `CreateUserInput`.
 * @returns Đối tượng người dùng vừa được tạo (chỉ bao gồm các trường an toàn).
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
 * Cập nhật thông tin người dùng theo ID.
 * @param id - ID người dùng cần cập nhật.
 * @param data - Các trường cần cập nhật.
 * @returns Đối tượng người dùng đã cập nhật hoặc null nếu không tìm thấy.
 */
export const updateUser = async (
  id: number,
  data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
): Promise<Omit<User, 'password'> | null> => {
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
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, name, email, phone, role_id, address, avatar, status, user_type, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
};

/**
 * Xóa người dùng theo ID.
 * @param id - ID người dùng cần xóa.
 * @returns true nếu xóa thành công, false nếu không tìm thấy.
 */
export const deleteUser = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};

/**
 * Lấy danh sách tất cả người dùng.
 * @returns Mảng các đối tượng người dùng (không có password).
 */
export const getAllUsers = async (): Promise<Omit<User, 'password'>[]> => {
  const result = await pool.query(
    'SELECT id, name, email, phone, role_id, address, avatar, status, user_type, created_at, updated_at FROM users'
  );
  return result.rows;
};
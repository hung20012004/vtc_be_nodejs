import pool from '../../config/db';
import { User } from '../types/user.type';

// Kiểu dữ liệu cho việc tạo nhân viên, không cần token xác thực
export type CreateStaffInput = Pick<User, 'name' | 'email' | 'password' | 'role_id' | 'branch_id'>;

/**
 * Tạo một nhân viên mới trong bảng users.
 */
export const createStaff = async (staffData: CreateStaffInput): Promise<Pick<User, 'id' | 'name' | 'email' | 'role_id'>> => {
    const { name, email, password, role_id, branch_id } = staffData;
    const user_type = 1; // 1 = Staff
    const status = 1;    // 1 = Active by default

    const result = await pool.query(
        `INSERT INTO users (name, email, password, role_id, user_type, status, branch_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, role_id`,
        [name, email, password, role_id, user_type, status, branch_id]
    );
    return result.rows[0];
};

/**
 * Lấy danh sách tất cả nhân viên (user_type = 1).
 */
export const findAllStaff = async () => {
    const result = await pool.query(`
        SELECT u.id, u.name, u.email, u.phone, u.status, u.branch_id,
               r.name as role_name, b.name as branch_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.user_type != 2 AND u.deleted_at IS NULL
        ORDER BY u.name ASC
    `);
    return result.rows;
};

/**
 * Tìm một nhân viên bằng ID.
 */
export const findStaffById = async (id: number) => {
    const result = await pool.query(`
        SELECT u.id, u.name, u.email, u.phone, u.status, u.branch_id, u.role_id,
               r.name as role_name, b.name as branch_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.id = $1 AND u.user_type = 1 AND u.deleted_at IS NULL
    `, [id]);
    return result.rows[0] || null;
};

/**
 * Cập nhật thông tin nhân viên.
 */
export const updateStaff = async (id: number, data: Partial<Omit<User, 'id' | 'password'>>) => {
    const fields = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    if (fields.length === 0) return findStaffById(id);
    const values = Object.values(data);
    const result = await pool.query(
        `UPDATE users SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1} AND user_type = 1 RETURNING id, name, email, role_id, branch_id, status`,
        [...values, id]
    );
    return result.rows[0] || null;
};

/**
 * Xóa mềm một nhân viên.
 */
export const softDeleteStaff = async (id: number): Promise<boolean> => {
    const result = await pool.query(
        'UPDATE users SET deleted_at = NOW(), status = 2 WHERE id = $1 AND user_type = 1 AND deleted_at IS NULL',
        [id]
    );
    return (result.rowCount ?? 0) > 0;
};
import pool from '../../../config/db';
import { User } from '../../types/authentication/user.type';
import bcrypt from 'bcrypt';

/**
 * Lấy thông tin profile chi tiết cho NHÂN VIÊN.
 */
export const getStaffProfile = async (userId: number) => {
    const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.user_type, u.role_id, u.branch_id,
                r.name as role_name, b.name as branch_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId]
    );
    return result.rows[0] || null;
};

/**
 * Lấy thông tin profile chi tiết cho KHÁCH HÀNG.
 */
export const getCustomerProfile = async (userId: number) => {
    const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.user_type,
                c.id as customer_id, c.total_spent, c.order_count, c.last_order_date
         FROM users u
         JOIN customers c ON u.id = c.user_id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId]
    );
    return result.rows[0] || null;
};

/**
 * Cập nhật profile cho NHÂN VIÊN.
 */
export const updateStaffProfile = async (userId: number, data: Partial<User>) => {
    const { name, phone, avatar } = data; // Nhân viên chỉ nên được sửa các trường này
    const result = await pool.query(
        'UPDATE users SET name = $1, phone = $2, avatar = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, email, phone, avatar',
        [name, phone, avatar, userId]
    );
    return result.rows[0];
};

/**
 * Cập nhật profile cho KHÁCH HÀNG (đồng bộ 2 bảng).
 */
export const updateCustomerProfile = async (userId: number, data: Partial<User>) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { name, phone, address, avatar } = data;
        
        const userUpdateResult = await client.query(
            'UPDATE users SET name = $1, phone = $2, avatar = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, phone, address, avatar, userId]
        );
        if (userUpdateResult.rows.length === 0) throw new Error('User not found.');

        await client.query(
            'UPDATE customers SET name = $1, phone = $2 WHERE user_id = $4',
            [name, phone, address, userId]
        );

        await client.query('COMMIT');
        return userUpdateResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Cập nhật mật khẩu (dùng chung cho cả hai).
 */
export const updateUserPassword = async (userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return { success: false, message: 'Không tìm thấy người dùng.' };

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return { success: false, message: 'Mật khẩu hiện tại không chính xác.' };

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

    return { success: true, message: 'Đổi mật khẩu thành công.' };
};
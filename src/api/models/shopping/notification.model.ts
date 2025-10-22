// src/api/models/notification.model.ts
import pool from '../../../config/db';
import { Notification } from '../../types/shopping/notification.type';

// Kiểu dữ liệu để tạo thông báo mới, server sẽ tự quản lý các trường còn lại
export type CreateNotificationInput = Pick<Notification, 'user_id' | 'title' | 'message' | 'type' | 'data'>;

/**
 * Lấy danh sách thông báo của một người dùng, có phân trang.
 */
export const getNotificationsByUserId = async (userId: number, limit: number, offset: number): Promise<{ notifications: Notification[], total: number }> => {
    const notificationsQuery = pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
    );
    const totalQuery = pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]);
    
    const [notificationsResult, totalResult] = await Promise.all([notificationsQuery, totalQuery]);

    return {
        notifications: notificationsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10),
    };
};

/**
 * Đánh dấu một thông báo là đã đọc.
 */
export const markAsRead = async (notificationId: number, userId: number): Promise<Notification | null> => {
    const result = await pool.query(
        'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING *',
        [notificationId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc.
 */
export const markAllAsRead = async (userId: number): Promise<void> => {
    await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [userId]);
};

/**
 * Hàm nội bộ để tạo thông báo (sẽ được gọi từ các service khác).
 */
export const createNotification = async (data: CreateNotificationInput): Promise<Notification> => {
    const { user_id, title, message, type, data: jsonData } = data;
    const result = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, data) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user_id, title, message, type, jsonData]
    );
    return result.rows[0];
};
// src/api/controllers/notification.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as NotificationModel from '../../models/shopping/notification.model';
import { User } from '../../types/authentication/user.type';

// Lấy danh sách thông báo của người dùng hiện tại
export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const { notifications, total } = await NotificationModel.getNotificationsByUserId(user.id, limit, offset);

        res.status(200).json({
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
            data: notifications,
        });
    } catch (error) {
        next(error);
    }
};

// Đánh dấu một thông báo là đã đọc
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const notificationId = parseInt(req.params.id, 10);
        const notification = await NotificationModel.markAsRead(notificationId, user.id);
        if (!notification) {
            return res.status(404).json({ message: 'Không tìm thấy thông báo hoặc đã được đọc.' });
        }
        res.status(200).json(notification);
    } catch (error) {
        next(error);
    }
};

// Đánh dấu tất cả là đã đọc
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        await NotificationModel.markAllAsRead(user.id);
        res.status(200).json({ message: 'Tất cả thông báo đã được đánh dấu là đã đọc.' });
    } catch (error) {
        next(error);
    }
};
// src/api/controllers/userActivityLog.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as LogModel from '../../models/authentication/user_activity_logs.model';

/**
 * Controller để lấy danh sách lịch sử hoạt động có phân trang.
 */
export const getAllLogsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Lấy các tham số phân trang từ query string, với giá trị mặc định
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const offset = (page - 1) * limit;

        const { logs, total } = await LogModel.getAllLogs(limit, offset);

        res.status(200).json({
            success: true,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
            },
            data: logs,
        });
    } catch (error) {
        next(error);
    }
};
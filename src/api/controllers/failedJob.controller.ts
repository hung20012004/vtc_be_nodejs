// src/api/controllers/failedJob.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as FailedJobModel from '../models/failed_jobs.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const getAllFailedJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const { jobs, total } = await FailedJobModel.findAll(limit, offset);
        res.status(200).json({
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
            data: jobs,
        });
    } catch (error) { next(error); }
};

export const deleteFailedJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await FailedJobModel.deleteById(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy job lỗi.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-failed-job',
            details: `User deleted failed job ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};

export const deleteAllFailedJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const count = await FailedJobModel.deleteAll();
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-all-failed-jobs',
            details: `User deleted all ${count} failed jobs.`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json({ message: `Đã xóa thành công ${count} job lỗi.` });
    } catch (error) { next(error); }
};
// src/api/models/failedJob.model.ts
import pool from '../../config/db';
import { FailedJob } from '../types/failed_job.type';

// Lấy tất cả các job lỗi, có phân trang
export const findAll = async (limit: number, offset: number): Promise<{ jobs: FailedJob[], total: number }> => {
    const jobsQuery = pool.query('SELECT * FROM failed_jobs ORDER BY failed_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const totalQuery = pool.query('SELECT COUNT(*) FROM failed_jobs');
    const [jobsResult, totalResult] = await Promise.all([jobsQuery, totalQuery]);
    return {
        jobs: jobsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10),
    };
};

// Tìm job lỗi theo ID
export const findById = async (id: number): Promise<FailedJob | null> => {
    const result = await pool.query('SELECT * FROM failed_jobs WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

// Xóa một job lỗi theo ID
export const deleteById = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM failed_jobs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};

// Xóa tất cả các job lỗi
export const deleteAll = async (): Promise<number> => {
    const result = await pool.query('DELETE FROM failed_jobs');
    return result.rowCount ?? 0;
};
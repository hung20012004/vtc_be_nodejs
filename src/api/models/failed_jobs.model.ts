import pool from '../../config/db';
import { FailedJob } from '../types/failed_jobs.type';

export const findFailedJobById = async (id: number): Promise<FailedJob | null> => {
  const result = await pool.query('SELECT * FROM failed_jobs WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllFailedJobs = async (): Promise<FailedJob[]> => {
  const result = await pool.query('SELECT * FROM failed_jobs');
  return result.rows;
};

export const createFailedJob = async (data: FailedJob): Promise<FailedJob> => {
  const { uuid, connection, queue, payload, exception, failed_at } = data;
  const result = await pool.query(
    `INSERT INTO failed_jobs (uuid, connection, queue, payload, exception, failed_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [uuid, connection, queue, payload, exception, failed_at]
  );
  return result.rows[0];
};

export const updateFailedJob = async (
  id: number,
  data: Partial<Omit<FailedJob, 'id'>>
): Promise<FailedJob | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const k in data) {
    fields.push(`${k} = $${idx}`);
    values.push((data as any)[k]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE failed_jobs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteFailedJob = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM failed_jobs WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
import pool from '../../config/db';
import { Report } from '../types/reports.type';

export type CreateReportInput = Pick<Report, 'name' | 'type' | 'data' | 'generated_at'>;

export const findReportById = async (id: number): Promise<Report | null> => {
  const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllReports = async (): Promise<Report[]> => {
  const result = await pool.query('SELECT * FROM reports');
  return result.rows;
};

export const createReport = async (data: CreateReportInput): Promise<Report> => {
  const { name, type, data: reportData, generated_at } = data;
  const result = await pool.query(
    `INSERT INTO reports (name, type, data, generated_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, type, reportData, generated_at]
  );
  return result.rows[0];
};

export const updateReport = async (
  id: number,
  data: Partial<CreateReportInput>
): Promise<Report | null> => {
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
    `UPDATE reports SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteReport = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM reports WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
import pool from '../../../config/db';
import { Branch } from '../../types/locations/branch.type';

export const create = async (data: Omit<Branch, 'id'|'created_at'|'updated_at'>): Promise<Branch> => {
    const { name, address, is_active } = data;
    const result = await pool.query(
        'INSERT INTO branches (name, address, is_active) VALUES ($1, $2, $3) RETURNING *',
        [name, address, is_active]
    );
    return result.rows[0];
};

export const findAll = async (): Promise<Branch[]> => {
    const result = await pool.query('SELECT * FROM branches ORDER BY name ASC');
    return result.rows;
};

export const findById = async (id: number): Promise<Branch | null> => {
    const result = await pool.query('SELECT * FROM branches WHERE id = $1', [id]);
    return result.rows[0] || null;
};

export const update = async (id: number, data: Partial<Omit<Branch, 'id'|'created_at'|'updated_at'>>): Promise<Branch | null> => {
    const fields = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    const values = Object.values(data);
    
    if (fields.length === 0) return findById(id);

    const result = await pool.query(
        `UPDATE branches SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
    );
    return result.rows[0] || null;
};

export const remove = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM branches WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
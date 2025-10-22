// src/api/models/supplier.model.ts
import pool from '../../../config/db';
import { Supplier } from '../../types/settings/supplier.type';

export type CreateSupplierInput = Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export const getAllSuppliers = async (): Promise<Supplier[]> => {
    const result = await pool.query('SELECT * FROM suppliers WHERE deleted_at IS NULL');
    return result.rows;
};

export const findSupplierById = async (id: number): Promise<Supplier | null> => {
    const result = await pool.query('SELECT * FROM suppliers WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const createSupplier = async (data: CreateSupplierInput): Promise<Supplier> => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO suppliers (${columns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
};

export const updateSupplier = async (id: number, data: UpdateSupplierInput): Promise<Supplier | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findSupplierById(id);
    const values = Object.values(data);
    const query = `UPDATE suppliers SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteSupplier = async (id: number): Promise<boolean> => {
    const result = await pool.query('UPDATE suppliers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
    return (result.rowCount ?? 0) > 0;
};
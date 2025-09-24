// src/api/models/shippingCarrier.model.ts
import pool from '../../config/db';
import { ShippingCarrier } from '../types/shipping.type';

export type CreateCarrierInput = Omit<ShippingCarrier, 'id' | 'created_at' | 'updated_at'>;
export type UpdateCarrierInput = Partial<CreateCarrierInput>;

export const findAll = async (): Promise<ShippingCarrier[]> => {
    const result = await pool.query('SELECT * FROM shipping_carriers');
    return result.rows;
};

export const findById = async (id: number): Promise<ShippingCarrier | null> => {
    const result = await pool.query('SELECT * FROM shipping_carriers WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const create = async (data: CreateCarrierInput): Promise<ShippingCarrier> => {
    const { name, code, contact_info, api_config, is_active } = data;
    const result = await pool.query(
        'INSERT INTO shipping_carriers (name, code, contact_info, api_config, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, code, contact_info, api_config, is_active]
    );
    return result.rows[0];
};

export const update = async (id: number, data: UpdateCarrierInput): Promise<ShippingCarrier | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findById(id);
    const values = Object.values(data);
    const query = `UPDATE shipping_carriers SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteById = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM shipping_carriers WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
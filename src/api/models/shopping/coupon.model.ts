// src/api/models/coupon.model.ts
import pool from '../../../config/db';
import { Coupon } from '../../types/shopping/coupon.type';

export type CreateCouponInput = Omit<Coupon, 'id' | 'created_at' | 'updated_at' | 'used_count'>;
export type UpdateCouponInput = Partial<CreateCouponInput>;

export const findAllCoupons = async (): Promise<Coupon[]> => {
    const result = await pool.query('SELECT * FROM coupons ORDER BY id DESC');
    return result.rows;
};

export const findCouponById = async (id: number): Promise<Coupon | null> => {
    const result = await pool.query('SELECT * FROM coupons WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const createCoupon = async (data: CreateCouponInput, createdBy: number): Promise<Coupon> => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    // Thêm created_by vào
    columns.push('created_by');
    values.push(createdBy);

    const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO coupons (${columns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
};

export const updateCoupon = async (id: number, data: UpdateCouponInput): Promise<Coupon | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findCouponById(id);
    
    const values = Object.values(data);
    const query = `UPDATE coupons SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteCoupon = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM coupons WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
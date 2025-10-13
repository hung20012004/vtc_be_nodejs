// src/api/models/customer.model.ts

import pool from '../../config/db';
import { Customer } from '../types/customer.type';
import { PoolClient } from 'pg';
export type CreateCustomerInput = Pick<Customer, 'name' | 'phone' | 'email' | 'address'>;
export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export const getAllCustomers = async (): Promise<Omit<Customer, 'password'>[]> => {
  const result = await pool.query('SELECT id, name, email, phone, address, order_count, total_spent, last_order_date FROM customers WHERE deleted_at IS NULL');
  return result.rows;
};

export const findCustomerById = async (id: number): Promise<Omit<Customer, 'password'> | null> => {
  const result = await pool.query('SELECT id, name, email, phone, address, order_count, total_spent, last_order_date FROM customers WHERE id = $1 AND deleted_at IS NULL', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const createCustomer = async (data: CreateCustomerInput & { user_id: number }, client?: PoolClient): Promise<Customer> => {
    const db = client || pool;
    const { name, phone, email, address, user_id } = data;
    const result = await db.query(
        'INSERT INTO customers (name, phone, email, address, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, phone, email, address, user_id]
    );
    return result.rows[0];
};

export const updateCustomer = async (id: number, data: UpdateCustomerInput): Promise<Omit<Customer, 'password'> | null> => {
  const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
  if (fields.length === 0) return findCustomerById(id);

  const values = Object.values(data);
  const query = `UPDATE customers SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING id, name, email, phone, address`;
  
  const result = await pool.query(query, [...values, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteCustomer = async (id: number): Promise<boolean> => {
  // Soft delete: Cập nhật trường deleted_at thay vì xóa vĩnh viễn
  const result = await pool.query('UPDATE customers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
  return (result.rowCount ?? 0) > 0;
};
/**
 * Tìm một khách hàng bằng user_id của họ.
 */
export const findCustomerByUserId = async (userId: number): Promise<Customer | null> => {
    const result = await pool.query('SELECT * FROM customers WHERE user_id = $1', [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};
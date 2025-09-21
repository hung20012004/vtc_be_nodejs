import pool from '../../config/db';
import { Customer } from '../types/customers.type';

export type CreateCustomerInput = Pick<Customer, 'name' | 'phone'>;

export const findCustomerById = async (id: number): Promise<Customer | null> => {
  const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllCustomers = async (): Promise<Customer[]> => {
  const result = await pool.query('SELECT * FROM customers');
  return result.rows;
};

export const createCustomer = async (data: CreateCustomerInput): Promise<Customer> => {
  const { name, phone } = data;
  const result = await pool.query(
    `INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING *`,
    [name, phone]
  );
  return result.rows[0];
};

export const updateCustomer = async (
  id: number,
  data: Partial<CreateCustomerInput>
): Promise<Customer | null> => {
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
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteCustomer = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM customers WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
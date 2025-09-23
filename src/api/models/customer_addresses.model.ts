import pool from '../../config/db';
import { CustomerAddress } from '../types/customer_addresses.type';

export type CreateCustomerAddressInput = Pick<CustomerAddress, 'customer_id' | 'address' | 'province_code' | 'district_code' | 'ward_code' | 'is_default'>;

export const findCustomerAddressById = async (id: number): Promise<CustomerAddress | null> => {
  const result = await pool.query('SELECT * FROM customer_addresses WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllCustomerAddresses = async (): Promise<CustomerAddress[]> => {
  const result = await pool.query('SELECT * FROM customer_addresses');
  return result.rows;
};

export const createCustomerAddress = async (data: CreateCustomerAddressInput): Promise<CustomerAddress> => {
  const { customer_id, address, province_code, district_code, ward_code, is_default } = data;
  const result = await pool.query(
    `INSERT INTO customer_addresses (customer_id, address, province_code, district_code, ward_code, is_default) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [customer_id, address, province_code, district_code, ward_code, is_default]
  );
  return result.rows[0];
};

export const updateCustomerAddress = async (
  id: number,
  data: Partial<CreateCustomerAddressInput>
): Promise<CustomerAddress | null> => {
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
    `UPDATE customer_addresses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteCustomerAddress = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM customer_addresses WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
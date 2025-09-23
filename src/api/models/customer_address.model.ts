// src/api/models/customerAddress.model.ts
import pool from '../../config/db';
import { CustomerAddress } from '../types/customer_address.type';

export type CreateAddressInput = Omit<CustomerAddress, 'id' | 'customer_id' | 'created_at' | 'updated_at'>;
export type UpdateAddressInput = Partial<CreateAddressInput>;

// Hàm helper để bỏ đánh dấu tất cả địa chỉ mặc định cũ của một khách hàng
const unsetOldDefaultAddresses = async (customerId: number, client: any) => {
  await client.query('UPDATE customer_addresses SET is_default = false WHERE customer_id = $1 AND is_default = true', [customerId]);
};

export const getAddressesByCustomerId = async (customerId: number): Promise<CustomerAddress[]> => {
  const result = await pool.query('SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, id DESC', [customerId]);
  return result.rows;
};

export const createAddress = async (customerId: number, data: CreateAddressInput): Promise<CustomerAddress> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Bắt đầu transaction

    if (data.is_default) {
      await unsetOldDefaultAddresses(customerId, client);
    }

    const { name, phone, address, province_code, district_code, ward_code, is_default } = data;
    const result = await client.query(
      `INSERT INTO customer_addresses (customer_id, name, phone, address, province_code, district_code, ward_code, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customerId, name, phone, address, province_code, district_code, ward_code, is_default]
    );
    
    await client.query('COMMIT'); // Lưu transaction
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK'); // Hoàn tác nếu có lỗi
    throw error;
  } finally {
    client.release(); // Trả kết nối về pool
  }
};

export const updateAddress = async (addressId: number, customerId: number, data: UpdateAddressInput): Promise<CustomerAddress | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (data.is_default) {
            await unsetOldDefaultAddresses(customerId, client);
        }
        
        const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
        if (fields.length === 0) {
            const current = await client.query('SELECT * FROM customer_addresses WHERE id=$1', [addressId]);
            return current.rows[0] || null;
        }

        const values = Object.values(data);
        const query = `UPDATE customer_addresses SET ${fields.join(', ')} WHERE id = $${values.length + 1} AND customer_id = $${values.length + 2} RETURNING *`;
        const result = await client.query(query, [...values, addressId, customerId]);
        
        await client.query('COMMIT');
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const deleteAddress = async (addressId: number, customerId: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [addressId, customerId]);
    return (result.rowCount ?? 0) > 0;
};
import pool from '../../../config/db';
import { CustomerAddress } from '../../types/locations/customer_address.type'; // Đảm bảo import type đúng
import { PoolClient } from 'pg';

export type CreateAddressInput = Omit<CustomerAddress, 'id' | 'customer_id' | 'created_at' | 'updated_at'>;
export type UpdateAddressInput = Partial<CreateAddressInput>;

/**
 * [HÀM CŨ] Tìm chi tiết địa chỉ bằng ID, bao gồm cả tên Tỉnh/Huyện/Xã.
 * Giữ nguyên hàm này vì nó vẫn hữu ích.
 */
export const findAddressDetailsById = async (addressId: number, client?: PoolClient) => {
    const db = client || pool;
    const result = await db.query(
        `SELECT
            ca.*,
            p.name as province_name,
            d.name as district_name,
            w.name as ward_name
         FROM customer_addresses ca
         LEFT JOIN provinces p ON ca.province_code = p.code
         LEFT JOIN districts d ON ca.district_code = d.code
         LEFT JOIN wards w ON ca.ward_code = w.code
         WHERE ca.id = $1`,
        [addressId]
    );
    return result.rows[0] || null;
};

// Hàm helper để bỏ đánh dấu mặc định cũ
const unsetOldDefaultAddresses = async (customerId: number, client: PoolClient) => {
    await client.query('UPDATE customer_addresses SET is_default = false WHERE customer_id = $1 AND is_default = true', [customerId]);
};

/**
 * [SỬA ĐỔI] Lấy danh sách địa chỉ của một khách hàng, bao gồm cả tên Tỉnh/Huyện/Xã.
 */
export const getAddressesByCustomerId = async (customerId: number): Promise<any[]> => { // Kiểu trả về có thể là any[] hoặc tạo type mới
    const result = await pool.query(
        `SELECT
            ca.id, ca.customer_id, ca.name, ca.phone, ca.address,
            ca.province_code, p.name as province_name,
            ca.district_code, d.name as district_name,
            ca.ward_code, w.name as ward_name,
            ca.is_default, ca.created_at, ca.updated_at
         FROM customer_addresses ca
         LEFT JOIN provinces p ON ca.province_code = p.code
         LEFT JOIN districts d ON ca.district_code = d.code
         LEFT JOIN wards w ON ca.ward_code = w.code
         WHERE ca.customer_id = $1
         ORDER BY ca.is_default DESC, ca.id DESC`, // Sắp xếp theo mặc định trước, rồi mới nhất
        [customerId]
    );
    return result.rows; // Trả về mảng các object địa chỉ đầy đủ
};


// Tạo một địa chỉ mới
export const createAddress = async (customerId: number, data: CreateAddressInput): Promise<CustomerAddress> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (data.is_default) {
            await unsetOldDefaultAddresses(customerId, client);
        }
        const { name, phone, address, province_code, district_code, ward_code, is_default } = data;
        const result = await client.query(
            `INSERT INTO customer_addresses (customer_id, name, phone, address, province_code, district_code, ward_code, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [customerId, name, phone, address, province_code, district_code, ward_code, is_default ?? false] // Đảm bảo is_default có giá trị
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Cập nhật một địa chỉ
export const updateAddress = async (addressId: number, customerId: number, data: UpdateAddressInput): Promise<CustomerAddress | null> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Nếu đang set địa chỉ này làm mặc định, bỏ mặc định các địa chỉ cũ trước
        if (data.is_default === true) {
            await unsetOldDefaultAddresses(customerId, client);
        }

        const fieldsToUpdate = Object.keys(data)
            .filter(key => data[key as keyof UpdateAddressInput] !== undefined); // Lọc các trường có giá trị

        if (fieldsToUpdate.length === 0) {
            // Nếu không có gì để cập nhật, trả về địa chỉ hiện tại để tránh lỗi
            await client.query('ROLLBACK'); // Không cần transaction nếu không update
            const current = await pool.query('SELECT * FROM customer_addresses WHERE id=$1 AND customer_id=$2', [addressId, customerId]);
            return current.rows[0] || null;
        }

        const setClauses = fieldsToUpdate.map((key, index) => `"${key}" = $${index + 1}`);
        const values = fieldsToUpdate.map(key => data[key as keyof UpdateAddressInput]);

        const query = `UPDATE customer_addresses
                       SET ${setClauses.join(', ')}, updated_at = NOW()
                       WHERE id = $${values.length + 1} AND customer_id = $${values.length + 2}
                       RETURNING *`;

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

// Xóa một địa chỉ
export const deleteAddress = async (addressId: number, customerId: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [addressId, customerId]);
    return (result.rowCount ?? 0) > 0;
};
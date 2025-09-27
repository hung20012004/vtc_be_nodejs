// src/api/models/order.model.ts
import pool from '../../config/db';
import { Order } from '../types/order.type';

// Input khi tạo đơn hàng (bỏ id, created_at, updated_at vì DB tự sinh)
export type CreateOrderInput = Pick<
  Order,
  | 'order_code'
  | 'customer_id'
  | 'order_date'
  | 'order_status'
  | 'total_amount'
  | 'shipping_address_id'
  | 'payment_method'
  | 'payment_status'
  | 'order_number'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_email'
  | 'shipping_address'
  | 'shipping_province'
  | 'shipping_district'
  | 'shipping_ward'
  | 'subtotal'
>;

export const findOrderById = async (id: number): Promise<Order | null> => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllOrders = async (): Promise<Order[]> => {
  const result = await pool.query('SELECT * FROM orders ORDER BY order_date DESC');
  return result.rows;
};

export const createOrder = async (data: CreateOrderInput): Promise<Order> => {
  const {
    order_code,
    customer_id,
    order_date,
    order_status,
    total_amount,
    shipping_address_id,
    payment_method,
    payment_status,
    order_number,
    customer_name,
    customer_phone,
    customer_email,
    shipping_address,
    shipping_province,
    shipping_district,
    shipping_ward,
    subtotal,
  } = data;

  const result = await pool.query(
    `
    INSERT INTO orders (
      order_code, customer_id, order_date, order_status, total_amount,
      shipping_address_id, payment_method, payment_status, order_number,
      customer_name, customer_phone, customer_email, shipping_address,
      shipping_province, shipping_district, shipping_ward, subtotal
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *
    `,
    [
      order_code,
      customer_id,
      order_date,
      order_status,
      total_amount,
      shipping_address_id,
      payment_method,
      payment_status,
      order_number,
      customer_name,
      customer_phone,
      customer_email,
      shipping_address,
      shipping_province,
      shipping_district,
      shipping_ward,
      subtotal,
    ]
  );

  return result.rows[0];
};

export const updateOrder = async (
  id: number,
  data: Partial<CreateOrderInput>
): Promise<Order | null> => {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const key in data) {
    fields.push(`${key} = $${idx}`);
    values.push((data as any)[key]);
    idx++;
  }

  if (fields.length === 0) return null;

  values.push(id);

  const result = await pool.query(
    `UPDATE orders SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
    values
  );

  return result.rows[0] || null;
};


export const deleteOrder = async (id: number): Promise<boolean> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Nếu DB chưa có cascade -> xóa explicit
    await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
    await client.query('DELETE FROM order_status_histories WHERE order_id = $1', [id]);

    // Xóa order
    const result = await client.query('DELETE FROM orders WHERE id = $1', [id]);

    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Lấy tất cả đơn hàng theo customer_id
export const findOrdersByCustomerId = async (customerId: number): Promise<Order[]> => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE customer_id = $1 ORDER BY order_date DESC',
    [customerId]
  );
  return result.rows;
};


export const updateOrderStatus = async (orderId: number, status: string) => {
  const query = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *';
  const values = [status, orderId];
  const result = await pool.query(query, values);
  return result.rows[0];
};

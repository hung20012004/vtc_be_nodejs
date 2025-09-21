import pool from '../../config/db';
import { Order } from '../types/orders.type';

export type CreateOrderInput = Pick<Order, 'order_code' | 'customer_id' | 'order_date' | 'order_status' | 'total_amount' | 'shipping_address_id' | 'payment_method' | 'payment_status'>;

export const findOrderById = async (id: number): Promise<Order | null> => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllOrders = async (): Promise<Order[]> => {
  const result = await pool.query('SELECT * FROM orders');
  return result.rows;
};

export const createOrder = async (data: CreateOrderInput): Promise<Order> => {
  const { order_code, customer_id, order_date, order_status, total_amount, shipping_address_id, payment_method, payment_status } = data;
  const result = await pool.query(
    `INSERT INTO orders (order_code, customer_id, order_date, order_status, total_amount, shipping_address_id, payment_method, payment_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [order_code, customer_id, order_date, order_status, total_amount, shipping_address_id, payment_method, payment_status]
  );
  return result.rows[0];
};

export const updateOrder = async (
  id: number,
  data: Partial<CreateOrderInput>
): Promise<Order | null> => {
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
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteOrder = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM orders WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
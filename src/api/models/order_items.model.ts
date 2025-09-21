import pool from '../../config/db';
import { OrderItem } from '../types/order_items.type';

export type CreateOrderItemInput = Pick<OrderItem, 'order_id' | 'product_id' | 'quantity' | 'price'>;

export const findOrderItemById = async (id: number): Promise<OrderItem | null> => {
  const result = await pool.query('SELECT * FROM order_items WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllOrderItems = async (): Promise<OrderItem[]> => {
  const result = await pool.query('SELECT * FROM order_items');
  return result.rows;
};

export const createOrderItem = async (data: CreateOrderItemInput): Promise<OrderItem> => {
  const { order_id, product_id, quantity, price } = data;
  const result = await pool.query(
    `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4) RETURNING *`,
    [order_id, product_id, quantity, price]
  );
  return result.rows[0];
};

export const updateOrderItem = async (
  id: number,
  data: Partial<CreateOrderItemInput>
): Promise<OrderItem | null> => {
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
    `UPDATE order_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteOrderItem = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM order_items WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
// src/api/models/orderStatusHistory.model.ts

import pool from '../../config/db';
import { OrderStatusHistory } from '../types/orderStatusHistory.type';

export type CreateOrderStatusHistoryInput = Pick<
  OrderStatusHistory,
  | 'order_id'
  | 'from_status'
  | 'to_status'
  | 'notes'
  | 'changed_by'
>;

export type UpdateOrderStatusHistoryInput = Partial<CreateOrderStatusHistoryInput>;

export const getAllOrderStatusHistories = async (): Promise<OrderStatusHistory[]> => {
  const result = await pool.query('SELECT * FROM order_status_histories ORDER BY created_at DESC');
  return result.rows;
};

export const findOrderStatusHistoryById = async (id: number): Promise<OrderStatusHistory | null> => {
  const result = await pool.query('SELECT * FROM order_status_histories WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const findOrderStatusHistoriesByOrderId = async (orderId: number): Promise<OrderStatusHistory[]> => {
  const result = await pool.query(
    'SELECT * FROM order_status_histories WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  return result.rows;
};

export const createOrderStatusHistory = async (data: CreateOrderStatusHistoryInput): Promise<OrderStatusHistory> => {
  const {
    order_id,
    from_status,
    to_status,
    notes,
    changed_by,
  } = data;

  const result = await pool.query(
    `INSERT INTO order_status_histories (
      order_id, from_status, to_status, notes, changed_by
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [order_id, from_status, to_status, notes, changed_by]
  );

  return result.rows[0];
};

export const updateOrderStatusHistory = async (
  id: number,
  data: UpdateOrderStatusHistoryInput
): Promise<OrderStatusHistory | null> => {
  const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
  if (fields.length === 0) return findOrderStatusHistoryById(id);

  const values = Object.values(data);
  const query = `UPDATE order_status_histories SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;

  const result = await pool.query(query, [...values, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};


export const deleteOrderStatusHistoriesByOrderId = async (orderId: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM order_status_histories WHERE order_id = $1', [orderId]);
  return (result.rowCount ?? 0) > 0;
};

export const getOrderStatusHistoriesWithUserInfo = async (orderId: number) => {
  const result = await pool.query(
    `SELECT 
      osh.*,
      u.name as changed_by_name,
      u.email as changed_by_email
    FROM order_status_histories osh
    LEFT JOIN users u ON osh.changed_by = u.id
    WHERE osh.order_id = $1
    ORDER BY osh.created_at ASC`,
    [orderId]
  );
  return result.rows;
};


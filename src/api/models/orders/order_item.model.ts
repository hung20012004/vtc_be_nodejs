// src/api/models/orderItem.model.ts

import pool from '../../../config/db';
import { OrderItem } from '../../types/orders/order_item.type';

export type CreateOrderItemInput = Pick<
  OrderItem,
  | 'order_id'
  | 'product_id'
  | 'variant_id'
  | 'product_name'
  | 'product_sku'
  | 'quantity'
  | 'unit_price'
  | 'batch_number'
  | 'expiry_date'
>;

export type UpdateOrderItemInput = Partial<CreateOrderItemInput>;

export const getAllOrderItems = async (): Promise<OrderItem[]> => {
  const result = await pool.query('SELECT * FROM order_items ORDER BY id DESC');
  return result.rows;
};

export const findOrderItemById = async (id: number): Promise<OrderItem | null> => {
  const result = await pool.query('SELECT * FROM order_items WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const findOrderItemsByOrderId = async (orderId: number): Promise<OrderItem[]> => {
  const result = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC',
    [orderId]
  );
  return result.rows;
};

export const createOrderItem = async (data: CreateOrderItemInput): Promise<OrderItem> => {
  const {
    order_id,
    product_id,
    variant_id,
    product_name,
    product_sku,
    quantity,
    unit_price,
    batch_number,
    expiry_date,
  } = data;

  const result = await pool.query(
    `INSERT INTO order_items (
      order_id, product_id, variant_id, product_name, product_sku,
      quantity, unit_price, batch_number, expiry_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      order_id,
      product_id,
      variant_id,
      product_name,
      product_sku,
      quantity,
      unit_price,
      batch_number,
      expiry_date,
    ]
  );

  return result.rows[0];
};

export const updateOrderItem = async (
  id: number,
  data: UpdateOrderItemInput
): Promise<OrderItem | null> => {
  const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
  if (fields.length === 0) return findOrderItemById(id);

  const values = Object.values(data);
  const query = `UPDATE order_items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;

  const result = await pool.query(query, [...values, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteOrderItem = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM order_items WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};

export const deleteOrderItemsByOrderId = async (orderId: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  return (result.rowCount ?? 0) > 0;
};

export const getOrderItemsWithProductInfo = async (orderId: number) => {
  const result = await pool.query(
    `SELECT 
      oi.*,
      p.name as product_name_full,
      p.images,
      pv.name as variant_name,
      pv.sku as variant_sku
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = $1
    ORDER BY oi.id ASC`,
    [orderId]
  );
  return result.rows;
};

// Helper function để kiểm tra order thuộc về customer
export const findOrderById = async (id: number) => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const findOrderItemInOrder = async (orderId: number, itemId: number) => {
  const result = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1 AND id = $2',
    [orderId, itemId]
  );
  return result.rows[0];
};


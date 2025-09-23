import pool from '../../config/db';
import { OrderTransaction } from '../types/order_transactions.type';

export type CreateOrderTransactionInput = Pick<
  OrderTransaction,
  'order_id' | 'transaction_code' | 'amount' | 'payment_gateway_id' | 'status'
>;

export const findOrderTransactionById = async (id: number): Promise<OrderTransaction | null> => {
  const result = await pool.query('SELECT * FROM order_transactions WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllOrderTransactions = async (): Promise<OrderTransaction[]> => {
  const result = await pool.query('SELECT * FROM order_transactions');
  return result.rows;
};

export const createOrderTransaction = async (
  data: CreateOrderTransactionInput
): Promise<OrderTransaction> => {
  const { order_id, transaction_code, amount, payment_gateway_id, status } = data;
  const result = await pool.query(
    `INSERT INTO order_transactions (order_id, transaction_code, amount, payment_gateway_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [order_id, transaction_code, amount, payment_gateway_id, status]
  );
  return result.rows[0];
};

export const updateOrderTransaction = async (
  id: number,
  data: Partial<CreateOrderTransactionInput>
): Promise<OrderTransaction | null> => {
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
    `UPDATE order_transactions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteOrderTransaction = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM order_transactions WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
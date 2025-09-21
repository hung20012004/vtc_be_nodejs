import pool from '../../config/db';
import { PaymentGateway } from '../types/payment_gateways.type';

export type CreatePaymentGatewayInput = Pick<PaymentGateway, 'name' | 'code' | 'is_active'>;

export const findPaymentGatewayById = async (id: number): Promise<PaymentGateway | null> => {
  const result = await pool.query('SELECT * FROM payment_gateways WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllPaymentGateways = async (): Promise<PaymentGateway[]> => {
  const result = await pool.query('SELECT * FROM payment_gateways');
  return result.rows;
};

export const createPaymentGateway = async (data: CreatePaymentGatewayInput): Promise<PaymentGateway> => {
  const { name, code, is_active } = data;
  const result = await pool.query(
    `INSERT INTO payment_gateways (name, code, is_active) VALUES ($1, $2, $3) RETURNING *`,
    [name, code, is_active]
  );
  return result.rows[0];
};

export const updatePaymentGateway = async (
  id: number,
  data: Partial<CreatePaymentGatewayInput>
): Promise<PaymentGateway | null> => {
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
    `UPDATE payment_gateways SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deletePaymentGateway = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM payment_gateways WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
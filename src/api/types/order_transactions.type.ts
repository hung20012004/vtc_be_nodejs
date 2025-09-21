export interface OrderTransaction {
  id: number;
  order_id: number;
  transaction_code: string;
  amount: number;
  payment_gateway_id: number | null;
  status: string;
  created_at: Date;
}
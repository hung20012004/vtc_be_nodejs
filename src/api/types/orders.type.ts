export interface Order {
  id: number;
  order_code: string;
  customer_id?: number;
  order_date: Date;
  order_status: string;
  total_amount: number;
  shipping_address_id?: number;
  payment_method?: string;
  payment_status?: string;
  created_at: Date;
  updated_at: Date;
}
export interface CouponUsage {
  id: number;
  counpon_id: string;
  customer_id: string;
  order_id: string;
  discount_amount: string;
  used_at: Date
}
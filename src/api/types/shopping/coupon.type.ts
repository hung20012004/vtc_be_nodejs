// src/api/types/coupon.type.ts

export interface Coupon {
  id: number;
  name: string;
  description: string | null;
  type: 'fixed' | 'percentage';
  value: number;
  minimum_amount: number;
  maximum_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  usage_limit_per_customer: number | null;
  start_date: Date | null;
  end_date: Date | null;
  applicable_categories: number[] | null; // Mảng các category_id
  applicable_products: number[] | null;   // Mảng các product_id
  is_active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CouponUsage {
    id: number;
    coupon_id: number;
    customer_id: number;
    order_id: number;
    discount_amount: number;
    used_at: Date;
}
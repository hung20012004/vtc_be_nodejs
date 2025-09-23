export interface Coupon {
  id: number;
  name: string;
  description: string;
  type: string;
  value: string;
  minimum_amount: string;
  maximum_amount: string;
  usage_limit: string;
  used_count: number;
  used_limit_per_customer: string;
  start_date: Date;
  end_date: Date;
  applicable_categories: string;
  applicable_products: string;
  is_active: boolean;
  created_by: string;
}
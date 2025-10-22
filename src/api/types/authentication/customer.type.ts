
export interface Customer {
  user_id: number;
  id: number;
  name: string;
  email: string | null;
  phone: string;
  password?: string;
  address: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  total_spent: number;
  order_count: number;
  last_order_date: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
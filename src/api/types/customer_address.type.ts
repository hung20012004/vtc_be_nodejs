export interface CustomerAddress {
  id: number;
  customer_id: number;
  name: string;
  phone: string;
  address: string;
  province_code: string | null;
  district_code: string | null;
  ward_code: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}
export interface CustomerAddress {
  id: number;
  customer_id: number;
  address: string;
  province_code?: string;
  district_code?: string;
  ward_code?: string;
  is_default: boolean;
}
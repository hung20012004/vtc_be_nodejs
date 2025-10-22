// src/api/types/supplier.type.ts
export interface Supplier {
  id: number;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  contact_person: string | null;
  tax_code: string | null;
  bank_account: string | null;
  bank_name: string | null;
  status: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
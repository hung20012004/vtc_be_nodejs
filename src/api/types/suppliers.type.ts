export interface Supplier {
  id: number;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  status: boolean;
  created_at: Date;
  updated_at: Date;
}
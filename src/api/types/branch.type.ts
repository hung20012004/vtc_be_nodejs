export interface Branch {
  id: number;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
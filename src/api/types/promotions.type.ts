export interface Promotion {
  id: number;
  code: string;
  type: string;
  value: number;
  start_date?: Date;
  end_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
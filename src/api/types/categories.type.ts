export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
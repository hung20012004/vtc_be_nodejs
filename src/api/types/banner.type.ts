// src/api/types/banner.type.ts
export interface Banner {
  id: number;
  title: string;
  image: string;
  link: string | null;
  position: string;
  sort_order: number;
  start_date: Date | null;
  end_date: Date | null;
  click_count: number;
  view_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
// src/api/types/product.type.ts

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  category_id: number;
  unit_id: number;
  description: string | null;
  short_description: string | null;
  specifications: Record<string, any> | null; // JSONB
  images: Record<string, any> | null; // JSONB
  price: number;
  compare_price: number | null;
  cost_price: number | null;
  weight: number | null;
  dimensions: string | null;
  stock_quantity: number;
  min_stock: number;
  track_inventory: boolean;
  is_fresh: boolean;
  shelf_life_days: number | null;
  storage_conditions: string | null;
  origin: string | null;
  harvest_season: string | null;
  organic_certified: boolean;
  is_featured: boolean;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  search_vector: string | null;
}
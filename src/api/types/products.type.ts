export interface Product {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  category_id: number;
  unit_id: number;
  description?: string;
  images: any; // JSONB
  price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  search_vector?: string;
}

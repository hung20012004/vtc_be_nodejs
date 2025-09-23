export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  sku?: string;
  price: number;
  stock_quantity: number;
  created_at: Date;
  updated_at: Date;
}
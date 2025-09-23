export interface ProductReview {
  id: number;
  product_id: number;
  customer_id: number;
  rating: number;
  comment?: string;
  created_at: Date;
}
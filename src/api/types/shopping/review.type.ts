// src/api/types/review.type.ts
export interface ProductReview {
  id: number;
  product_id: number;
  customer_id: number;
  order_id: number | null;
  rating: number;
  title: string | null;
  content: string | null;
  images: string[] | null; // Mảng các URL ảnh
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}
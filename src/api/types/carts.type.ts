// src/api/types/cart.type.ts
import { Product } from './product.type';

// Đại diện cho một dòng trong bảng carts
export interface CartItem {
  id: number;
  customer_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

// Kiểu dữ liệu trả về khi xem giỏ hàng, bao gồm thông tin sản phẩm
export interface CartItemWithProductDetails extends CartItem {
    product: Pick<Product, 'name' | 'price' | 'images' | 'slug'>;
}
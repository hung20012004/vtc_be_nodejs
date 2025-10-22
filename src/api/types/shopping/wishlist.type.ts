// src/api/types/wishlist.type.ts
import { Product } from '../products/product.type';

// Đại diện cho một dòng trong bảng wishlists
export interface Wishlist {
  customer_id: number;
  product_id: number;
}

// Kiểu dữ liệu trả về khi xem wishlist, bao gồm thông tin sản phẩm
export interface WishlistItemWithProductDetails {
    product: Pick<Product, 'id' | 'name' | 'slug' | 'price' | 'images'>;
}
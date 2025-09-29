// src/api/types/orderItem.type.ts

export interface OrderItem {
    id: number;
    order_id: number;
    product_id: number;
    variant_id: number | null;
    product_name: string;
    product_sku: string | null;
    quantity: number;
    unit_price: number;
    batch_number: string | null;
    expiry_date: Date | null;
  }
  
// src/api/types/orders/order.type.ts

export interface Order {
  id: number;
  order_number: string; // Changed from optional, assuming this is the main identifier now
  customer_id?: number;
  order_date: Date;
  order_status: string;
  total_amount: number;
  shipping_address_id?: number;
  payment_method?: string;
  payment_status?: string;

  // Renamed columns for recipient info
  recipient_name?: string; // Renamed from customer_name
  recipient_phone?: string; // Renamed from customer_phone

  // New columns for account owner info
  account_customer_name?: string;
  account_customer_phone?: string;

  customer_email?: string; // Keeping this, assuming it's related to the recipient or for contact
  shipping_address?: string;
  shipping_province?: string;
  shipping_district?: string;
  shipping_ward?: string;
  subtotal: number;
  shipping_fee?: number;
  discount_amount?: number;
  tax_amount?: number;
  required_date?: Date;
  shipping_status?: number;
  coupon_code?: string;
  notes?: string;
  internal_notes?: string;
  assigned_to?: number;
  confirmed_by?: number;
  confirmed_at?: Date;
  shipped_at?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
  cancel_reason?: string;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
  // order_code?: string; // Removed as per your request
}
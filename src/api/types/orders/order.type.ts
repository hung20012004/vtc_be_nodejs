// src/api/types/order.type.ts

export interface Order {
  id: number;
  order_code: string;
  customer_id?: number;            // bigint, có thể null
  order_date: Date;                // timestamp with time zone
  order_status: string;            // varchar(50), not null
  total_amount: number;            // numeric(15,2), not null
  shipping_address_id?: number;    // bigint, có thể null
  payment_method?: string;         // varchar(100), có thể null
  payment_status?: string;         // varchar(50), có thể null
  order_number?: string;           // varchar(50), có thể null
  customer_name?: string;          // varchar(255), có thể null
  customer_phone?: string;         // varchar(20), có thể null
  customer_email?: string;         // varchar(255), có thể null
  shipping_address?: string;       // text, có thể null
  shipping_province?: string;      // varchar(100), có thể null
  shipping_district?: string;      // varchar(100), có thể null
  shipping_ward?: string;          // varchar(100), có thể null
  subtotal: number;                // numeric(15,2), not null
  shipping_fee?: number;           // numeric(15,2), có thể null
  discount_amount?: number;        // numeric(15,2), có thể null
  tax_amount?: number;             // numeric(15,2), có thể null
  required_date?: Date;            // date, có thể null
  shipping_status?: number;        // smallint, có thể null
  coupon_code?: string;            // varchar(50), có thể null
  notes?: string;                  // text, có thể null
  internal_notes?: string;         // text, có thể null
  assigned_to?: number;            // bigint, có thể null
  confirmed_by?: number;           // bigint, có thể null
  confirmed_at?: Date;             // timestamp with time zone, có thể null
  shipped_at?: Date;               // timestamp with time zone, có thể null
  delivered_at?: Date;             // timestamp with time zone, có thể null
  cancelled_at?: Date;             // timestamp with time zone, có thể null
  cancel_reason?: string;          // text, có thể null
  created_by?: number;             // bigint, có thể null
  created_at: Date;                // timestamp with time zone
  updated_at: Date;                // timestamp with time zone
  
}
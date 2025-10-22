// src/api/types/orderStatusHistory.type.ts

export interface OrderStatusHistory {
  id: number;
  order_id: number;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  changed_by: number | null;
  created_at: Date;
}

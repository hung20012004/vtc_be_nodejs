export interface InventoryAudit {
  id: number;
  product_id: number;
  audit_date: Date;
  expected_quantity: number;
  actual_quantity: number;
  difference: number;
  user_id?: number;
  notes?: string;
}
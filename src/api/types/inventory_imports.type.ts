export interface InventoryImport {
  id: number;
  import_code: string;
  supplier_id?: number;
  import_date: Date;
  total_amount: number;
  status: string;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}
export interface InventoryExport {
  id: number;
  export_code: string;
  export_date: Date;
  reason?: string;
  status: string;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}
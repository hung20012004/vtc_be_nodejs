
export interface InventoryImport {
  id: number;
  import_code: string;
  supplier_id: number | null;
  import_date: Date;
  total_amount: number;
  paid_amount: number;
  note: string | null;
  status: string;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryImportDetail {
  id: number;
  import_id: number;
  product_id: number;
  variant_id: number | null;
  import_quantity: number; 
  import_price: number;
  manufacture_date: Date | null; 
  expiry_date: Date | null;      
  lot_number: string | null;     
}
export interface InventoryStock {
  id: number;
  product_id: number;
  variant_id: number | null;
  batch_number: string | null;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  unit_cost: number | null;
  expiry_date: Date | null;
  production_date: Date | null;
  import_date: Date | null;
  location: string | null;
}

export interface InventoryAudit {
    id: number;
    stock_id: number;
    user_id: number;
    action: string;
    quantity_change: number;
    reason: string | null;
    created_at: Date;
}
export interface InventoryExport {
  id: number;
  export_code: string;
  type: number;
  reference_id: number | null;
  export_date: Date;
  total_quantity: number;
  notes: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryExportDetail {
  id: number;
  export_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  unit_price: number | null;
  batch_number: string | null;
  expiry_date: Date | null;
  reason: string | null;
}
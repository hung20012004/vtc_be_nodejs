// src/api/types/inventory.type.ts

export interface InventoryImport {
  // ... interface này giữ nguyên
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

// CẬP NHẬT LẠI HOÀN TOÀN INTERFACE NÀY
export interface InventoryImportDetail {
  id: number;
  import_id: number;
  product_id: number;
  variant_id: number | null;
  import_quantity: number; // Đổi tên từ quantity
  import_price: number;
  manufacture_date: Date | null; // Thêm mới
  expiry_date: Date | null;      // Thêm mới
  lot_number: string | null;     // Thêm mới
}
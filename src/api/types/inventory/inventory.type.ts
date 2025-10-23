export interface InventoryImport {
    id: number;
    import_code: string;
    supplier_id: number | null;
    import_date: Date;
    total_amount: number;
    status: 'draft' | 'requested' | 'approved' | 'paid' | 'completed' | 'cancelled' | 'rejected' | 'receipt_rejected';
    note: string | null;
    created_by: number;
    requested_by: number | null;
    approved_by: number | null;
    received_by: number | null;
    requested_at: Date | null;
    approved_at: Date | null;
    received_at: Date | null;
    payment_status: 'unpaid' | 'paid';
    created_at: Date;
    updated_at: Date;
}

export interface InventoryImportDetail {
    id: number;
    import_id: number;
    product_id: number;
    variant_id: number; // Đã là NOT NULL trong DB
    import_quantity: number;
    import_price: number;
}

export type ExportStatus =
  | 'pending' // Trạng thái cũ, có thể không dùng cho type=3 nữa
  | 'completed' // Dùng khi chi nhánh nhận hàng (thay cho 'received') hoặc khi hủy hàng (type=2)
  | 'in_transit' // Trạng thái cũ, có thể thay bằng 'shipped'
  | 'cancelled'
  // Trạng thái mới cho quy trình type=3
  | 'branch_pending'     // Chờ QL Chi nhánh duyệt
  | 'branch_rejected'    // QL Chi nhánh từ chối
  | 'warehouse_pending'  // Chờ QL Kho tổng duyệt
  | 'warehouse_rejected' // QL Kho tổng từ chối
  | 'processing'         // Đã duyệt, chờ NV Kho tổng soạn hàng
  | 'shipped';           // NV Kho tổng đã gửi

export interface InventoryExport {
    id: number;
    export_code: string;
    type: number; // 1: Bán hàng, 2: Hủy, 3: Chuyển kho
    reference_id: number | null;
    from_branch_id: number; // Với type=3: Chi nhánh yêu cầu
    to_branch_id: number | null; // Với type=3: Kho nguồn (0)
    total_quantity: number | null; // Có thể null ban đầu
    export_date: Date | null; // Có thể null ban đầu, set khi gửi hàng
    status: ExportStatus; // Sử dụng kiểu Union Type mới
    notes: string | null;
    created_at: Date; // Thời điểm tạo bản ghi (có thể khác requested_at)
    updated_at: Date;

    // Các trường mới thêm vào DB
    requested_by: number | null; // ID người yêu cầu (NV Chi nhánh)
    requested_at: Date | null;
    branch_manager_id: number | null;
    branch_reviewed_at: Date | null;
    warehouse_manager_id: number | null;
    warehouse_reviewed_at: Date | null;
    shipped_by: number | null;
    shipped_at: Date | null;
    received_by: number | null;
    received_at: Date | null;

    // Trường cũ (có thể đổi tên hoặc giữ nguyên tùy DB)
    created_by: number; // Có thể hiểu là người tạo bản ghi ban đầu

     // Các trường join để hiển thị tên
     created_by_name?: string; // Tên người tạo ban đầu
     requested_by_name?: string;
     branch_manager_name?: string;
     warehouse_manager_name?: string;
     shipped_by_name?: string;
     received_by_name?: string;
     from_branch_name?: string; // Tên chi nhánh yêu cầu
     to_branch_name?: string;   // Tên kho nguồn
}

export interface InventoryExportDetail {
    id: number;
    export_id: number;
    product_id: number;
    variant_id: number;
    quantity: number; // Số lượng yêu cầu/duyệt/xuất
}

// Dành cho Phiếu Kiểm kho (Giữ nguyên)
export interface InventoryCheck {
    id: number;
    branch_id: number;
    user_id: number;
    check_date: Date;
    notes: string | null;
    status: 'pending' | 'completed';
}

export interface InventoryCheckItem {
    id: number;
    inventory_check_id: number;
    variant_id: number;
    previous_quantity: number;
    counted_quantity: number;
    adjustment: number;
}
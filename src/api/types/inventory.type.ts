export interface InventoryImport {
    id: number;
    import_code: string;
    supplier_id: number | null;
    import_date: Date;
    total_amount: number;
    status: 'draft' | 'requested' | 'approved' | 'paid' | 'completed' | 'cancelled';
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

// Dành cho Phiếu Xuất kho / Chuyển kho
export interface InventoryExport {
    id: number;
    export_code: string;
    type: number; // 1: Bán hàng, 2: Hủy, 3: Chuyển kho
    reference_id: number | null;
    from_branch_id: number; // Thêm từ câu trả lời trước
    to_branch_id: number | null;
    total_quantity: number;
    export_date: Date;
    status: string; // pending, completed, in_transit, cancelled
    notes: string | null;
    created_by: number;
    created_at: Date;
    updated_at: Date;
}

export interface InventoryExportDetail {
    id: number;
    export_id: number;
    product_id: number;
    variant_id: number;
    quantity: number;
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

export interface CartItem {
    id: number;
    customer_id: number;
    variant_id: number; // <-- Bắt buộc
    quantity: number;
    created_at: Date;
    updated_at: Date;
}

// Cấu trúc đầy đủ khi trả về cho client, bao gồm cả thông tin sản phẩm và phiên bản
export interface CartItemWithProductDetails {
    id: number;
    quantity: number;
    variant: {
        id: number;
        name: string | null; // Tên phiên bản, vd: "Size L, Màu Đỏ"
        price: number;
        image: string | null;
        sku: string | null;
    };
    product: {
        id: number;
        name: string;
        slug: string;
    };
}

// Dữ liệu đầu vào khi thêm sản phẩm vào giỏ
export type AddItemInput = {
    customerId: number;
    variantId: number; // <-- Bắt buộc
    quantity: number;
};
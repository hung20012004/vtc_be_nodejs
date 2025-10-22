export interface Payment {
    id: number;
    order_id: number;
    payment_method: string; // 'cod', 'vnpay', 'momo', etc.
    amount: number;
    transaction_id: string | null;
    gateway: string | null; // 'VNPay', 'Momo'
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    payment_date: Date | null;
    notes: string | null;
}
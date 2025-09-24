// src/api/models/review.model.ts
import pool from '../../config/db';
import { ProductReview } from '../types/review.type';

// Public: Lấy các review đã được duyệt của một sản phẩm
export const findApprovedByProductId = async (productId: number): Promise<any[]> => {
    const result = await pool.query(
        `SELECT pr.*, c.name as customer_name
         FROM product_reviews pr
         JOIN customers c ON pr.customer_id = c.id
         WHERE pr.product_id = $1 AND pr.status = 'approved'
         ORDER BY pr.created_at DESC`, [productId]
    );
    return result.rows;
};

// Customer: Tạo một review mới
export const create = async (data: Omit<ProductReview, 'id'|'status'|'created_at'|'updated_at'>): Promise<ProductReview> => {
    // Logic kiểm tra xem customer đã mua sản phẩm này chưa
    const orderCheck = await pool.query(
        `SELECT o.id FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE o.customer_id = $1 AND oi.product_id = $2 AND o.order_status = 'completed'`,
        [data.customer_id, data.product_id]
    );
    if (orderCheck.rows.length === 0) {
        throw new Error('Bạn chỉ có thể đánh giá sản phẩm đã mua thành công.');
    }
    const order_id = orderCheck.rows[0].id; // Gán order_id để xác thực

    const { product_id, customer_id, rating, title, content, images } = data;
    const result = await pool.query(
        'INSERT INTO product_reviews (product_id, customer_id, order_id, rating, title, content, images) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [product_id, customer_id, order_id, rating, title, content, JSON.stringify(images || [])]
    );
    return result.rows[0];
};

// Admin: Lấy tất cả review để quản lý
export const findAll = async (): Promise<any[]> => {
    const result = await pool.query('SELECT * FROM product_reviews ORDER BY created_at DESC');
    return result.rows;
};

// Admin: Cập nhật trạng thái (kiểm duyệt)
export const updateStatus = async (id: number, status: 'approved' | 'rejected'): Promise<ProductReview | null> => {
    const result = await pool.query('UPDATE product_reviews SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};
// src/api/models/report.model.ts
import pool from '../../config/db';
import { DailySalesReport } from '../types/report.type';

/**
 * Lấy danh sách báo cáo trong một khoảng thời gian.
 */
export const findDailyReports = async (startDate: string, endDate: string): Promise<DailySalesReport[]> => {
    const result = await pool.query(
        'SELECT * FROM daily_sales_reports WHERE report_date >= $1 AND report_date <= $2 ORDER BY report_date DESC',
        [startDate, endDate]
    );
    return result.rows;
};

/**
 * Tính toán và tạo/cập nhật báo cáo cho một ngày cụ thể.
 */
export const generateDailyReport = async (reportDate: string): Promise<DailySalesReport> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Tính toán các chỉ số từ bảng orders
        const ordersMetrics = await client.query(
            `SELECT
                COUNT(*) AS total_orders,
                COUNT(*) FILTER (WHERE order_status = 'completed') AS completed_orders,
                COUNT(*) FILTER (WHERE order_status = 'cancelled') AS cancelled_orders,
                COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'completed'), 0) AS total_revenue
             FROM orders
             WHERE DATE(order_date) = $1`,
            [reportDate]
        );
        
        // 2. Tính toán tổng chi phí (cost) từ các đơn hàng đã hoàn thành
        const costMetrics = await client.query(
            `SELECT COALESCE(SUM(oi.quantity * p.cost_price), 0) AS total_cost
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.order_status = 'completed' AND DATE(o.order_date) = $1`,
            [reportDate]
        );

        // 3. Đếm số lượng khách hàng mới
        const newCustomersMetric = await client.query(
            'SELECT COUNT(*) AS new_customers FROM customers WHERE DATE(created_at) = $1',
            [reportDate]
        );

        const { total_orders, completed_orders, cancelled_orders, total_revenue } = ordersMetrics.rows[0];
        const { total_cost } = costMetrics.rows[0];
        const { new_customers } = newCustomersMetric.rows[0];
        const total_profit = parseFloat(total_revenue) - parseFloat(total_cost);

        // 4. Dùng UPSERT (ON CONFLICT) để chèn hoặc cập nhật báo cáo
        const result = await client.query(
            `INSERT INTO daily_sales_reports (report_date, total_orders, completed_orders, cancelled_orders, total_revenue, total_cost, total_profit, new_customers)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (report_date)
             DO UPDATE SET
                total_orders = EXCLUDED.total_orders,
                completed_orders = EXCLUDED.completed_orders,
                cancelled_orders = EXCLUDED.cancelled_orders,
                total_revenue = EXCLUDED.total_revenue,
                total_cost = EXCLUDED.total_cost,
                total_profit = EXCLUDED.total_profit,
                new_customers = EXCLUDED.new_customers
             RETURNING *`,
            [reportDate, total_orders, completed_orders, cancelled_orders, total_revenue, total_cost, total_profit, new_customers]
        );
        
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
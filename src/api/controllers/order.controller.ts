import { Request, Response, NextFunction } from 'express';
import pool from '../../config/db';
import * as OrderModel from '../models/order.model';
import * as CustomerModel from '../models/customer.model';
import { User } from '../types/user.type';
// Giả sử bạn có service này
// import { PaymentService } from '../services/payment.service'; 
// const paymentService = new PaymentService();

// ===================================
// == API DÀNH CHO KHÁCH HÀNG (USER)
// ===================================

export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        await client.query('BEGIN');
        const { newOrder, totalAmount } = await OrderModel.placeOrder(customer.id, req.body, client);

        let paymentUrl = null;
        // Nếu là thanh toán online, tạo link thanh toán và bản ghi payment
        if (newOrder.payment_method.toLowerCase() === 'vnpay') {
            // paymentUrl = await paymentService.createVnPayUrl(newOrder.id, totalAmount, req.ip);
            await client.query(
                `INSERT INTO payments (order_id, payment_method, amount, status, gateway) VALUES ($1, 'vnpay', $2, 'pending', 'VNPay')`,
                [newOrder.id, totalAmount]
            );
        } else {
             await client.query(
                `INSERT INTO payments (order_id, payment_method, amount, status) VALUES ($1, 'cod', $2, 'pending')`,
                [newOrder.id, totalAmount]
            );
        }
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Đặt hàng thành công!',
            order: newOrder,
            paymentUrl: paymentUrl, // Trả về URL thanh toán nếu có
        });

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

// ... (getMyOrders, getMyOrderById)

// ===================================
// == API DÀNH CHO QUẢN TRỊ (ADMIN)
// ===================================

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    // Logic lấy tất cả đơn hàng
};

export const getOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
    // Logic lấy chi tiết một đơn hàng
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const orderId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const user = req.user as User;

        if (!status) return res.status(400).json({ message: 'Vui lòng cung cấp trạng thái mới.' });
        
        await client.query('BEGIN');
        const updatedOrderResult = await OrderModel.updateOrderStatus(orderId, status, user.id, client);
        await client.query('COMMIT');

        res.status(200).json({
            message: 'Cập nhật trạng thái đơn hàng thành công.',
            order: updatedOrderResult.rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error);
    } finally {
        client.release();
    }
};
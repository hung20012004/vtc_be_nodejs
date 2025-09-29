// src/api/controllers/orderStatusHistory.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as OrderStatusHistoryModel from '../models/orderStatusHistory.model';
import * as OrderModel from '../models/order.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';
import pool from '../../config/db';

// -------------------- ADMIN / GLOBAL --------------------

export const getAllOrderStatusHistories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const histories = await OrderStatusHistoryModel.getAllOrderStatusHistories();
    res.status(200).json(histories);
  } catch (error) {
    next(error);
  }
};

export const getOrderStatusHistoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const history = await OrderStatusHistoryModel.findOrderStatusHistoryById(id);
    
    if (!history) {
      return res.status(404).json({ message: 'Không tìm thấy lịch sử trạng thái đơn hàng.' });
    }
    
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
};

export const getOrderStatusHistoriesByOrderId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const histories = await OrderStatusHistoryModel.findOrderStatusHistoriesByOrderId(orderId);
    res.status(200).json(histories);
  } catch (error) {
    next(error);
  }
};


export const createOrderStatusHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    const newHistory = await OrderStatusHistoryModel.createOrderStatusHistory({
      ...req.body,
      changed_by: user?.id || null,
    });
    
    if (user) {
      await createActivityLog({
        user_id: user.id,
        action: 'create-order-status-history',
        details: `User created status history for order ID: ${newHistory.order_id}`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
      });
    }
    
    res.status(201).json(newHistory);
  } catch (error) {
    next(error);
  }
};

// src/api/controllers/orderStatusHistory.controller.ts
export const updateOrderStatus = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { order_status, payment_status, notes } = req.body;
  const changedBy = (req.user as any)?.id || null;

  if (!order_status && !payment_status) {
    return res.status(400).json({ message: 'Cần có ít nhất order_status hoặc payment_status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lấy trạng thái cũ
    const orderResult = await client.query(
      'SELECT order_status, payment_status FROM orders WHERE id = $1',
      [orderId]
    );
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    const oldOrder = orderResult.rows[0];

    // 2. Update order
    const updatedOrderResult = await client.query(
      `UPDATE orders 
       SET order_status = COALESCE($1, order_status), 
           payment_status = COALESCE($2, payment_status), 
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [order_status || null, payment_status || null, orderId]
    );
    const updatedOrder = updatedOrderResult.rows[0];

    // 3. Luôn thêm bản ghi mới vào history nếu order_status thay đổi
    let newHistory = null;
    if (order_status && order_status !== oldOrder.order_status) {
      const historyResult = await client.query(
        `INSERT INTO order_status_histories 
         (order_id, from_status, to_status, notes, changed_by, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING *`,
        [orderId, oldOrder.order_status, order_status, notes || null, changedBy]
      );
      newHistory = historyResult.rows[0];
    }

    await client.query('COMMIT');

    res.json({
      message: 'Cập nhật đơn hàng thành công',
      order: updatedOrder,
      history: newHistory,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
};





// -------------------- USER / SELF --------------------

export const getMyOrderStatusHistories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
    }

    const orderId = parseInt(req.params.orderId, 10);
    
    // Kiểm tra đơn hàng có thuộc về khách hàng này không
    const order = await OrderModel.findOrderById(orderId);
    if (!order || order.customer_id !== user.id) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    const histories = await OrderStatusHistoryModel.findOrderStatusHistoriesByOrderId(orderId);
    res.status(200).json(histories);
  } catch (error) {
    next(error);
  }
};

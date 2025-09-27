// src/api/controllers/order.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as OrderModel from '../models/order.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';
import pool from '../../config/db';

// -------------------- ADMIN / GLOBAL --------------------

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await OrderModel.getAllOrders();
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Validate ID
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID đơn hàng không hợp lệ.' });
    }

    const order = await OrderModel.findOrderById(id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Tính subtotal từ items
    let subtotal = 0;
    if (req.body.items && Array.isArray(req.body.items)) {
      subtotal = req.body.items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unit_price,
        0
      );
    }

    const total_amount =
      subtotal +
      (req.body.shipping_fee || 0) -
      (req.body.discount_amount || 0) +
      (req.body.tax_amount || 0);

    // 2. Tạo order
    const orderResult = await client.query(
      `INSERT INTO orders 
      (order_code, customer_id, order_date, order_status, total_amount,
       subtotal, shipping_fee, discount_amount, tax_amount, shipping_address,
       customer_name, customer_phone, customer_email, created_by, created_at, updated_at)
      VALUES ($1,$2,NOW(),$3,$4,
              $5,$6,$7,$8,$9,
              $10,$11,$12,$13,NOW(),NOW())
      RETURNING *`,
      [
        req.body.order_code,
        req.body.customer_id || null,
        "Đang kiểm tra hàng", // mặc định
        total_amount,
        subtotal,
        req.body.shipping_fee || 0,
        req.body.discount_amount || 0,
        req.body.tax_amount || 0,
        req.body.shipping_address || null,
        req.body.customer_name || null,
        req.body.customer_phone || null,
        req.body.customer_email || null,
        (req.user as any)?.id || null,
      ]
    );

    const newOrder = orderResult.rows[0];

    // 3. Thêm order_items
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        await client.query(
          `INSERT INTO order_items 
            (order_id, product_id, variant_id, product_name, product_sku, 
             quantity, unit_price, batch_number, expiry_date, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
          [
            newOrder.id,
            item.product_id,
            item.variant_id || null,
            item.product_name,
            item.product_sku || null,
            item.quantity,
            item.unit_price,
            item.batch_number || null,
            item.expiry_date || null,
          ]
        );
      }
    }

    // 4. Thêm order_status_history (mặc định "Đang kiểm tra hàng")
    await client.query(
      `INSERT INTO order_status_histories 
   (order_id, from_status, to_status, notes, changed_by, created_at)
   VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        newOrder.id,
        null,                          // from_status
        "Đang kiểm tra hàng",          // to_status
        null,                          // notes
        (req.user as any)?.id || null, // changed_by
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Tạo đơn hàng thành công",
      order: newOrder,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

// src/api/controllers/order.controller.ts
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

    // 1. Lấy order hiện tại
    const orderResult = await client.query(
      'SELECT order_status, payment_status FROM orders WHERE id = $1',
      [orderId]
    );
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const oldOrder = orderResult.rows[0];

    // 2. Update orders
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

    // 3. Luôn thêm log mới vào order_status_histories
    const historyResult = await client.query(
      `INSERT INTO order_status_histories 
       (order_id, from_status, to_status, notes, changed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        orderId,
        oldOrder.order_status,         // from_status
        updatedOrder.order_status,     // to_status
        notes || null,
        changedBy,
      ]
    );

    const newHistory = historyResult.rows[0];

    await client.query('COMMIT');

    return res.json({
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




export const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID đơn hàng không hợp lệ.' });

    const success = await OrderModel.deleteOrder(id);
    if (!success) return res.status(404).json({ message: 'Không tìm thấy đơn hàng để xóa.' });

    const user = req.user as User;

    if (user) {
      await createActivityLog({
        user_id: user.id,
        action: 'delete-order',
        details: `User deleted order ID: ${id}`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
      });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const deleteOrderItemAndRecalcOrder = async (orderId: number, itemId: number) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Xóa item
    const delRes = await client.query(
      'DELETE FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId]
    );
    if (delRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    // Recalculate order subtotal + total_amount
    const totalRes = await client.query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) AS subtotal
       FROM order_items
       WHERE order_id = $1`,
      [orderId]
    );
    const subtotal = totalRes.rows[0].subtotal;

    await client.query(
      `UPDATE orders
       SET subtotal = $1,
           total_amount = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [subtotal, orderId]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};



// -------------------- USER / SELF --------------------

export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
    }

    const orders = await OrderModel.findOrdersByCustomerId(user.id);
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

export const getMyOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
    }

    const id = parseInt(req.params.id, 10);
    const order = await OrderModel.findOrderById(id);

    if (!order || order.customer_id !== user.id) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};
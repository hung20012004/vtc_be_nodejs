// src/api/controllers/orderItem.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as OrderItemModel from '../models/order_item.model';
import * as OrderModel from '../models/order.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';
import pool from '../../config/db';

// -------------------- ADMIN / GLOBAL --------------------


export const getOrderItemById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const orderItem = await OrderItemModel.findOrderItemById(id);
    
    if (!orderItem) {
      return res.status(404).json({ message: 'Không tìm thấy chi tiết đơn hàng.' });
    }
    
    res.status(200).json(orderItem);
  } catch (error) {
    next(error);
  }
};

export const getOrderItemsByOrderId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const orderItems = await OrderItemModel.findOrderItemsByOrderId(orderId);
    res.status(200).json(orderItems);
  } catch (error) {
    next(error);
  }
};

export const getOrderItemsWithProductInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const orderItems = await OrderItemModel.getOrderItemsWithProductInfo(orderId);
    res.status(200).json(orderItems);
  } catch (error) {
    next(error);
  }
};

export const createOrderItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newOrderItem = await OrderItemModel.createOrderItem(req.body);
    const user = req.user as User;
    
    if (user) {
      await createActivityLog({
        user_id: user.id,
        action: 'create-order-item',
        details: `User created order item for order ID: ${newOrderItem.order_id}`,
        ip: req.ip ?? null,
        user_agent: req.get('User-Agent') ?? null,
      });
    }
    
    res.status(201).json(newOrderItem);
  } catch (error) {
    next(error);
  }
};





export const updateOrderItemAndRecalcOrder = async (
  itemId: number,
  data: Partial<{ quantity: number; unit_price: number }>
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lấy order_id, quantity, unit_price cũ
    const oldRes = await client.query(
      'SELECT order_id, quantity, unit_price FROM order_items WHERE id = $1 FOR UPDATE',
      [itemId]
    );
    if (oldRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const old = oldRes.rows[0];
    const newQuantity = data.quantity ?? old.quantity;
    const newUnitPrice = data.unit_price ?? old.unit_price;

    // Update order_item
    const updateRes = await client.query(
      `UPDATE order_items
       SET quantity = $1, unit_price = $2
       WHERE id = $3
       RETURNING *`,
      [newQuantity, newUnitPrice, itemId]
    );
    const updatedItem = updateRes.rows[0];

    // Recalculate order subtotal + total_amount
    const totalRes = await client.query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) AS subtotal
       FROM order_items
       WHERE order_id = $1`,
      [old.order_id]
    );
    const subtotal = parseFloat(totalRes.rows[0].subtotal) || 0;

    await client.query(
      `UPDATE orders
       SET subtotal = $1,
           total_amount = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [subtotal, old.order_id]
    );

    await client.query('COMMIT');
    return updatedItem;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};


// -------------------- USER / SELF --------------------

export const getMyOrderItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const user = req.user as User;
    // if (!user) {
    //   return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
    // }

    // const orderId = parseInt(req.params.orderId, 10);
    
    // // Kiểm tra đơn hàng có thuộc về khách hàng này không
    // const order = await OrderModel.findOrderById(orderId);
    // if (!order || order.customer_id !== user.id) {
    //   return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    // }

    // const orderItems = await OrderItemModel.findOrderItemsByOrderId(orderId);
    // res.status(200).json(orderItems);
  } catch (error) {
    next(error);
  }
};


export const getOrderItemInOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);

    const orderItem = await OrderItemModel.findOrderItemInOrder(orderId, itemId);

    if (!orderItem) {
      return res.status(404).json({ message: 'Không tìm thấy chi tiết đơn hàng trong order này.' });
    }

    res.status(200).json(orderItem);
  } catch (error) {
    next(error);
  }
};

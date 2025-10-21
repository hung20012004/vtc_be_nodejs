import { Request, Response, NextFunction } from 'express';
import pool from '../../config/db';
import * as OrderModel from '../models/order.model';
import * as CustomerModel from '../models/customer.model';
import { User } from '../types/user.type';
import { ShippingService } from '../services/shipping.service';
import axios from 'axios';
import { Order } from '../types/order.type';
const shippingService = new ShippingService();
// const paymentService = new PaymentService();

// --- THÔNG TIN KHO HÀNG ---
const SHOP_INFO = {
    from_name: "FruitApp Shop",
    from_phone: "0393337820",
    from_address: "Phường Dịch Vọng",
    from_ward_code: "1A0601",
    from_district_id: 1485,
};

// ===================================
// == API DÀNH CHO KHÁCH HÀNG (USER)
// ===================================

export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        const { addressId, shippingOption, paymentMethod, notes } = req.body;

        if (!addressId || !shippingOption || !shippingOption.fee || !shippingOption.service_id || !shippingOption.service_type_id || !paymentMethod) {
            return res.status(400).json({ message: 'Dữ liệu đặt hàng không hợp lệ. Vui lòng kiểm tra addressId, shippingOption (fee, service_id, service_type_id), paymentMethod.' });
        }

        await client.query('BEGIN');

        const orderDataForModel = { addressId, shippingOption, paymentMethod, notes };
        const { newOrder, orderItems, shippingAddress, totalWeight, totalAmount } = await OrderModel.placeOrder(customer.id, orderDataForModel, client);

        if (!shippingAddress.ward_code || !shippingAddress.district_code) {
             throw new Error('Thông tin địa chỉ giao hàng thiếu mã Phường/Xã hoặc Quận/Huyện.');
        }
        const ghnOrderPayload = {
            to_name: shippingAddress.name,
            to_phone: shippingAddress.phone,
            to_address: shippingAddress.address,
            to_ward_code: shippingAddress.ward_code,
            to_district_id: shippingAddress.district_code,
            ...SHOP_INFO,
            weight: Math.max(Math.round(totalWeight), 10),
            length: 30, width: 20, height: 15,
            insurance_value: Math.round(newOrder.subtotal),
            service_id: shippingOption.service_id,
            service_type_id: shippingOption.service_type_id,
            payment_type_id: 2,
            cod_amount: paymentMethod.toLowerCase() === 'cod' ? Math.round(totalAmount) : 0,
            required_note: "CHOXEMHANGKHONGTHU",
            note: notes || "",
            client_order_code: newOrder.order_number,
            items: orderItems.map((item: any) => ({
                name: item.full_name,
                code: item.sku || `VAR-${item.variant_id}`,
                quantity: item.quantity,
                price: Math.round(Number(item.price)),
                weight: Math.max(Math.round(item.weight || 100), 10),
                length: item.length || 10,
                width: item.width || 10,
                height: item.height || 5,
            }))
        };

        const shipmentResult = await shippingService.createOrder('ghn', ghnOrderPayload);
        if (!shipmentResult || !shipmentResult.order_code || !shipmentResult.total_fee) {
            throw new Error('Tạo vận đơn GHN không thành công hoặc thiếu thông tin trả về.');
        }

        await client.query(
            `INSERT INTO shipments (order_id, carrier_code, tracking_number, shipping_cost, estimated_delivery_date, status)
             VALUES ($1, $2, $3, $4, $5, 'created')`,
            [
                newOrder.id, 'ghn', shipmentResult.order_code,
                shipmentResult.total_fee,
                shipmentResult.expected_delivery_time ? new Date(shipmentResult.expected_delivery_time) : null
            ]
        );

        let paymentUrl = null;
        if (newOrder.payment_method && newOrder.payment_method.toLowerCase() === 'vnpay') {
            // paymentUrl = await paymentService.createVnPayUrl(...);
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status, gateway) VALUES ($1, 'vnpay', $2, 'pending', 'VNPay')`, [newOrder.id, totalAmount]);
        } else {
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status) VALUES ($1, 'cod', $2, 'pending')`, [newOrder.id, totalAmount]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Đặt hàng và tạo đơn vận chuyển thành công!',
            order: newOrder,
            shipment: {
                tracking_number: shipmentResult.order_code,
                carrier: 'ghn',
                fee: shipmentResult.total_fee,
                expected_delivery_time: shipmentResult.expected_delivery_time
            },
            paymentUrl: paymentUrl,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        if (typeof error === 'object' && error !== null) {
            console.error("Place order error:", (error as any).response?.data || (error as any).message || error);
        } else {
            console.error("Place order error:", error);
        }
        if (axios.isAxiosError(error) && error.response?.data?.message) {
             return res.status(400).json({ message: `Lỗi từ GHN: ${error.response.data.message}` });
        }
        if (error instanceof Error) {
             return res.status(400).json({ message: error.message });
        }
        next(error);
    } finally {
        client.release();
    }
};

export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        const orders = await OrderModel.findOrdersByCustomerId(customer.id);
        res.status(200).json(orders);
    } catch (error) {
        next(error);
    }
};

export const getMyOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});

        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        const orderDetails = await OrderModel.findOrderDetailsById(orderId);
        if (!orderDetails || orderDetails.customer_id !== customer.id) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền xem.' });
        }
        res.status(200).json(orderDetails);
    } catch (error) {
        next(error);
    }
};

// ===================================
// == API DÀNH CHO QUẢN TRỊ (ADMIN)
// ===================================

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 15;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT o.*, c.name as customer_real_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            ORDER BY o.order_date DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const totalResult = await pool.query('SELECT COUNT(*) FROM orders');
        const totalOrders = parseInt(totalResult.rows[0].count, 10);

        res.status(200).json({
            data: result.rows,
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(totalOrders / limit),
                totalItems: totalOrders
            }
        });
    } catch(error) {
        next(error);
    }
};

export const getOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});

        const orderDetails = await OrderModel.findOrderDetailsById(orderId);
        if(!orderDetails) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

        // Shipment đã được join trong findOrderDetailsById, không cần query lại
        // const shipmentResult = await pool.query('SELECT * FROM shipments WHERE order_id = $1', [orderId]);
        // orderDetails.shipment = shipmentResult.rows[0] || null;

        res.status(200).json(orderDetails);
    } catch (error) {
        next(error);
    }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        const { status } = req.body as { status: Order['order_status'] };
        const user = req.user as User;

        if (isNaN(orderId)) return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});
        if (!status) return res.status(400).json({ message: 'Vui lòng cung cấp trạng thái mới.' });

        // Kiểm tra xem status có hợp lệ không (tùy chọn nhưng nên có)
        const validStatuses: Order['order_status'][] = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Trạng thái '${status}' không hợp lệ.`});
        }

        await client.query('BEGIN');

        const updatedOrder = await OrderModel.updateOrderStatus(orderId, status, user.id, client);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Cập nhật trạng thái đơn hàng thành công.',
            order: updatedOrder,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Update order status error:", error);
        if (error instanceof Error) return res.status(400).json({ message: error.message });
        next(error);
    } finally {
        client.release();
    }
};
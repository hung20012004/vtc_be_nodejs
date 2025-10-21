import { Request, Response, NextFunction } from 'express';
import pool from '../../config/db';
import * as OrderModel from '../models/order.model';
import * as CustomerModel from '../models/customer.model';
import { User } from '../types/user.type';
import { Order } from '../types/order.type'; // Import Order type
import { ShippingService } from '../services/shipping.service'; // Import service vận chuyển
import { VNPayService } from '../services/vnpay.service'; // Import VNPayService
import axios from 'axios'; // Import axios để kiểm tra lỗi AxiosError

// --- Khởi tạo các Service ---
const shippingService = new ShippingService();
const vnpayService = new VNPayService(); // Khởi tạo VNPayService

// --- THÔNG TIN KHO HÀNG CỦA BẠN ---
// **QUAN TRỌNG**: Thay bằng thông tin kho thật của bạn đã đăng ký với GHN
// Lý tưởng nhất là lưu trong DB hoặc file config
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

/**
 * @description Khách hàng đặt đơn hàng mới, lấy items từ giỏ hàng, tích hợp tạo vận đơn GHN.
 */
export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        const { addressId, shippingOption, paymentMethod, notes } = req.body;

        // --- Validation đầu vào ---
        if (!addressId || !shippingOption || !shippingOption.fee || !shippingOption.service_id || !shippingOption.service_type_id || !paymentMethod) {
            return res.status(400).json({ message: 'Dữ liệu đặt hàng không hợp lệ. Vui lòng kiểm tra addressId, shippingOption (fee, service_id, service_type_id), paymentMethod.' });
        }

        await client.query('BEGIN'); // Bắt đầu Transaction

        // 1. TẠO ĐƠN HÀNG TRONG DATABASE (Model tự lấy items từ cart, status ban đầu là pending)
        const orderDataForModel = { addressId, shippingOption, paymentMethod, notes };
        const { newOrder, orderItems, shippingAddress, totalWeight, totalAmount } = await OrderModel.placeOrder(customer.id, orderDataForModel, client);

        // 2. CHUẨN BỊ PAYLOAD TẠO VẬN ĐƠN GHN
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

        // 3. GỌI API GHN ĐỂ TẠO VẬN ĐƠN
        const shipmentResult = await shippingService.createOrder('ghn', ghnOrderPayload);
        if (!shipmentResult || !shipmentResult.order_code || !shipmentResult.total_fee) {
            throw new Error('Tạo vận đơn GHN không thành công hoặc thiếu thông tin trả về.');
        }

        // 4. LƯU THÔNG TIN VẬN ĐƠN VÀO BẢNG shipments
        await client.query(
            `INSERT INTO shipments (order_id, carrier_code, tracking_number, shipping_cost, estimated_delivery_date, status)
             VALUES ($1, $2, $3, $4, $5, 'created')`,
            [
                newOrder.id, 'ghn', shipmentResult.order_code,
                shipmentResult.total_fee,
                shipmentResult.expected_delivery_time ? new Date(shipmentResult.expected_delivery_time) : null
            ]
        );

        // 5. TẠO BẢN GHI THANH TOÁN & URL VNPay (nếu cần)
        let paymentUrl: string | null = null;
        if (newOrder.payment_method?.toLowerCase() === 'vnpay') {
            const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'; // Lấy IP, fallback về localhost nếu không có
            paymentUrl = vnpayService.createPaymentUrl(newOrder, totalAmount, ipAddr as string);
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status, gateway) VALUES ($1, 'vnpay', $2, 'pending', 'VNPay')`, [newOrder.id, totalAmount]);
        } else { // COD
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status) VALUES ($1, 'cod', $2, 'pending')`, [newOrder.id, totalAmount]);
        }

        // 6. COMMIT TRANSACTION
        await client.query('COMMIT');

        // 7. TRẢ KẾT QUẢ CHO CLIENT
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
            paymentUrl: paymentUrl, // Gửi URL về frontend để redirect
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Hoàn tác nếu có lỗi

        // Ghi log an toàn tuỳ theo kiểu lỗi
        if (axios.isAxiosError(error)) {
            console.error("Place order error (Axios):", error.response?.data ?? error.message ?? error);
        } else if (error instanceof Error) {
            console.error("Place order error:", error.message, error);
        } else {
            console.error("Place order error (unknown):", error);
        }

        // Xử lý lỗi từ GHN để trả về thông báo thân thiện hơn
        if (axios.isAxiosError(error) && error.response?.data?.message) {
             return res.status(400).json({ message: `Lỗi từ GHN: ${error.response.data.message}` });
        }
        if (error instanceof Error) {
             // Trả về lỗi nghiệp vụ (vd: hết hàng, sai địa chỉ)
             return res.status(400).json({ message: error.message });
        }
        next(error); // Chuyển lỗi khác cho middleware xử lý lỗi chung
    } finally {
        client.release(); // Luôn trả kết nối về pool
    }
};

/**
 * @description Khách hàng xem danh sách đơn hàng của mình.
 */
export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        const orders = await OrderModel.findOrdersByCustomerId(customer.id);
        res.status(200).json(orders);
    } catch (error) {
        console.error("Get My Orders error:", error);
        next(error);
    }
};

/**
 * @description Khách hàng xem chi tiết một đơn hàng của mình.
 */
export const getMyOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});

        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        const orderDetails = await OrderModel.findOrderDetailsById(orderId);
        // Kiểm tra đơn hàng tồn tại và thuộc về khách hàng này
        if (!orderDetails || orderDetails.customer_id !== customer.id) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền xem.' });
        }
        res.status(200).json(orderDetails);
    } catch (error) {
        console.error("Get My Order Details error:", error);
        next(error);
    }
};

// ===================================
// == API DÀNH CHO QUẢN TRỊ (ADMIN)
// ===================================

/**
 * @description Admin xem tất cả đơn hàng trong hệ thống (có phân trang).
 */
export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10; // Giảm limit mặc định
        const offset = (page - 1) * limit;

        // Thêm các tham số lọc nếu cần (ví dụ: status, customer_name, order_number)
        const { status, search } = req.query;
        let query = `
            SELECT o.*, c.name as customer_real_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
        `;
        const params: any[] = [];
        let whereClause = '';

        if (status) {
            params.push(status as string);
            whereClause += (whereClause ? ' AND ' : ' WHERE ') + `o.order_status = $${params.length}`;
        }
        if (search) {
             params.push(`%${search}%`);
             const searchParamIndex = params.length;
             whereClause += (whereClause ? ' AND ' : ' WHERE ') +
               `(o.order_number ILIKE $${searchParamIndex} OR o.customer_name ILIKE $${searchParamIndex} OR o.customer_phone ILIKE $${searchParamIndex})`;
        }

        query += whereClause;
        query += ` ORDER BY o.order_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Lấy tổng số lượng đơn hàng (có áp dụng filter) để phân trang
        let countQuery = `SELECT COUNT(*) FROM orders o`;
        let countParams: any[] = [];
        if (whereClause) {
             countQuery += whereClause;
             // Lấy params đã dùng cho filter (trừ limit, offset)
             countParams = params.slice(0, params.length - 2);
        }
        const totalResult = await pool.query(countQuery, countParams);
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
        console.error("Get All Orders error:", error);
        next(error);
    }
};

/**
 * @description Admin xem chi tiết một đơn hàng bất kỳ, bao gồm cả thông tin vận đơn.
 */
export const getOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});

        const orderDetails = await OrderModel.findOrderDetailsById(orderId);
        if(!orderDetails) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

        // Thông tin shipment đã được lấy trong model

        res.status(200).json(orderDetails);
    } catch (error) {
        console.error("Get Order Details error:", error);
        next(error);
    }
};

/**
 * @description Admin cập nhật trạng thái đơn hàng (xác nhận COD, xử lý, giao, hủy...).
 */
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        const { status } = req.body as { status: Order['order_status'] };
        const user = req.user as User; // Admin/Nhân viên thực hiện

        if (isNaN(orderId)) return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});
        if (!status) return res.status(400).json({ message: 'Vui lòng cung cấp trạng thái mới.' });

        const validStatuses: Order['order_status'][] = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Trạng thái '${status}' không hợp lệ.`});
        }

        await client.query('BEGIN'); // Bắt đầu Transaction

        // Gọi hàm model để xử lý cập nhật trạng thái và logic kho
        const updatedOrder = await OrderModel.updateOrderStatusByAdmin(orderId, status, user.id, client);

        await client.query('COMMIT'); // Kết thúc Transaction

        res.status(200).json({
            message: 'Cập nhật trạng thái đơn hàng thành công.',
            order: updatedOrder,
        });
    } catch (error) {
        await client.query('ROLLBACK'); // Hoàn tác nếu có lỗi
        console.error("Update order status error:", error);
        // Trả về lỗi nghiệp vụ (vd: chuyển trạng thái không hợp lệ, hết hàng)
        if (error instanceof Error) {
             return res.status(400).json({ message: error.message });
        }
        next(error); // Chuyển lỗi khác
    } finally {
        client.release(); // Luôn trả kết nối
    }
};
import { Request, Response, NextFunction } from 'express';
import pool from '../../../config/db'; // Đảm bảo đường dẫn đúng
import * as OrderModel from '../../models/orders/order.model'; // Đảm bảo đường dẫn đúng
import * as CustomerModel from '../../models/authentication/customer.model'; // Đảm bảo đường dẫn đúng
import { User } from '../../types/authentication/user.type'; // Đảm bảo đường dẫn đúng
import { Order } from '../../types/orders/order.type'; // Import Order type
import { ShippingService } from '../../services/shipping.service'; // Đảm bảo đường dẫn đúng
import { VNPayService } from '../../services/vnpay.service'; // Đảm bảo đường dẫn đúng
import { sendEmail } from '../../services/email.service'; // <<--- IMPORT HÀM GỬI EMAIL (Đảm bảo đường dẫn đúng)
import axios from 'axios'; // Import axios để kiểm tra lỗi AxiosError
import { v4 as uuidv4 } from 'uuid'; // <<--- IMPORT uuid
import { MomoService } from '../../services/momo.service'; 
// --- Khởi tạo các Service ---
const shippingService = new ShippingService();
const vnpayService = new VNPayService(); // Khởi tạo VNPayService
const momoService = new MomoService(); // Khởi tạo MomoService

// --- THÔNG TIN CỬA HÀNG/KHO HÀNG ---
// **QUAN TRỌNG**: Thay bằng thông tin thật của bạn
const SHOP_INFO = {
    from_name: "Nông Sản Sạch FruitApp", // Tên cửa hàng hiển thị trong email
    from_phone: "0393337820", // Số điện thoại kho (Thay bằng số thật)
    from_address: "Phường Dịch Vọng, Cầu Giấy, Hà Nội", // Địa chỉ chi tiết kho
    from_ward_code: "1A0601", // Mã Phường/Xã kho (Ví dụ: Dịch Vọng)
    from_district_id: 1485,  // Mã Quận/Huyện kho (Ví dụ: Cầu Giấy)
};
// ===================================
// == API DÀNH CHO KHÁCH HÀNG (USER)
// ===================================

/**
 * @description Khách hàng đặt đơn hàng mới, lấy items từ giỏ hàng, tích hợp tạo vận đơn GHN và gửi email xác nhận.
 */
export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    let customerEmail: string | undefined | null = null; // Biến lưu email khách hàng
    let newOrder: Order | null = null; // Biến lưu đơn hàng mới tạo
    let orderItemsForEmail: any[] = []; // Biến lưu items cho email
    let shipmentResultForEmail: any = null; // Biến lưu kết quả GHN cho email
    let customerNameForEmail: string | undefined | null = null; // Biến lưu tên khách hàng
    let paymentUrl: string | null = null; // Khai báo paymentUrl ở đây

    try {
        const user = req.user as User; // Lấy thông tin user đang đăng nhập
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });

        // Lấy email và tên khách hàng
        customerEmail = customer.email || user.email;
        customerNameForEmail = customer.name || user.name;
        if (!customerEmail) {
            console.warn(`Không tìm thấy email cho khách hàng ID: ${customer.id}, User ID: ${user.id}. Sẽ không gửi email xác nhận.`);
        }
        if (!customerNameForEmail) {
            console.warn(`Không tìm thấy tên cho khách hàng ID: ${customer.id}, User ID: ${user.id}. Email sẽ dùng lời chào chung.`);
            customerNameForEmail = "Quý khách"; // Lời chào mặc định
        }

        const { addressId, shippingOption, paymentMethod, notes } = req.body;

        // --- Validation đầu vào ---
        if (!addressId || !shippingOption || typeof shippingOption.fee !== 'number' || typeof shippingOption.service_id !== 'number' || typeof shippingOption.service_type_id !== 'number' || !paymentMethod) {
            return res.status(400).json({ message: 'Dữ liệu đặt hàng không hợp lệ. Vui lòng kiểm tra addressId, shippingOption (fee, service_id, service_type_id), paymentMethod.' });
        }
        const lowerPaymentMethod = paymentMethod.toLowerCase(); // Chuyển thành chữ thường để so sánh

        await client.query('BEGIN'); // Bắt đầu Transaction

        // 1. TẠO ĐƠN HÀNG TRONG DATABASE
        const orderDataForModel = { addressId, shippingOption, paymentMethod: lowerPaymentMethod, notes }; // Lưu PTTT chữ thường
        const { newOrder: createdOrder, orderItems, shippingAddress, totalWeight, totalAmount } = await OrderModel.placeOrder(customer.id, orderDataForModel, client);
        newOrder = createdOrder;
        orderItemsForEmail = orderItems; // Lưu items để dùng cho email

        // 2. CHUẨN BỊ PAYLOAD TẠO VẬN ĐƠN GHN
        if (!shippingAddress.ward_code || !shippingAddress.district_code) {
             throw new Error('Thông tin địa chỉ giao hàng thiếu mã Phường/Xã hoặc Quận/Huyện.');
        }

        // --- START: Full ghnOrderPayload ---
        const ghnOrderPayload = {
            // Thông tin người nhận
            to_name: shippingAddress.name,
            to_phone: shippingAddress.phone,
            to_address: shippingAddress.address,
            to_ward_code: shippingAddress.ward_code,
            to_district_id: shippingAddress.district_code,
            // Thông tin người gửi (lấy từ SHOP_INFO)
            from_name: SHOP_INFO.from_name,
            from_phone: SHOP_INFO.from_phone,
            from_address: SHOP_INFO.from_address,
            from_ward_code: SHOP_INFO.from_ward_code,
            from_district_id: SHOP_INFO.from_district_id,
            // Thông tin gói hàng
            weight: Math.max(Math.round(totalWeight), 10), // Cân nặng (gram), tối thiểu 10g
            length: 30, // Kích thước (cm) - Nên ước tính hoặc lấy từ sản phẩm
            width: 20,
            height: 15,
            insurance_value: Math.round(newOrder.subtotal), // Giá trị khai báo (bằng tạm tính)
            // Thông tin dịch vụ & thanh toán GHN
            service_id: shippingOption.service_id,
            service_type_id: shippingOption.service_type_id,
            payment_type_id: 2, // 2: Người mua/nhận trả phí vận chuyển
            cod_amount: lowerPaymentMethod === 'cod' ? Math.round(totalAmount) : 0, // Tiền thu hộ (nếu là COD)
            required_note: "CHOXEMHANGKHONGTHU", // Yêu cầu khi giao
            note: notes || "", // Ghi chú của khách hàng
            client_order_code: newOrder.order_number, // Mã đơn hàng của bạn để đối soát
            // Chi tiết sản phẩm trong gói hàng
            items: orderItems.map((item: any) => ({
                name: item.full_name,
                code: item.sku || `VAR-${item.variant_id}`, // Mã sản phẩm/variant
                quantity: item.quantity,
                price: Math.round(Number(item.price)), // Giá của 1 sản phẩm
                weight: Math.max(Math.round(item.weight || 100), 10), // Cân nặng 1 sản phẩm (gram), min 10g
                length: item.length || 10, // Kích thước 1 sản phẩm (cm)
                width: item.width || 10,
                height: item.height || 5,
            }))
        };
        // --- END: Full ghnOrderPayload ---

        // 3. GỌI API GHN ĐỂ TẠO VẬN ĐƠN
        const shipmentResult = await shippingService.createOrder('ghn', ghnOrderPayload);
        shipmentResultForEmail = shipmentResult; // Lưu kết quả GHN cho email
        if (!shipmentResult || !shipmentResult.order_code || typeof shipmentResult.total_fee !== 'number') {
            throw new Error('Tạo vận đơn GHN không thành công hoặc thiếu thông tin trả về (mã vận đơn, phí).');
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

        // 5. TẠO BẢN GHI THANH TOÁN & URL THANH TOÁN ONLINE
        if (lowerPaymentMethod === 'vnpay') {
            const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
            paymentUrl = await vnpayService.createPaymentUrl(newOrder, totalAmount, ipAddr as string);
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status, gateway) VALUES ($1, 'vnpay', $2, 'pending', 'VNPay')`, [newOrder.id, totalAmount]);
        } else if (lowerPaymentMethod === 'momo') { // <<--- LOGIC MOMO
            const requestId = uuidv4(); // Tạo requestId duy nhất
            paymentUrl = await momoService.createPaymentRequest(newOrder, totalAmount, requestId);
            // Lưu requestId vào payments nếu cần đối soát? Tùy chọn.
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status, gateway, notes) VALUES ($1, 'momo', $2, 'pending', 'Momo', $3)`, [newOrder.id, totalAmount, `requestId: ${requestId}`]);
        } else { // COD
            await client.query(`INSERT INTO payments (order_id, payment_method, amount, status) VALUES ($1, 'cod', $2, 'pending')`, [newOrder.id, totalAmount]);
        }

        // 6. COMMIT TRANSACTION
        await client.query('COMMIT');

        // --- 7. GỬI EMAIL XÁC NHẬN (SAU KHI COMMIT THÀNH CÔNG) ---
        // Chỉ gửi nếu có email và đơn hàng đã được tạo thành công
        if (customerEmail && newOrder && customerNameForEmail) { // Kiểm tra cả customerNameForEmail
            try {
                const emailSubject = `Xác nhận đơn hàng #${newOrder.order_number} tại ${SHOP_INFO.from_name}`;
                // Tạo nội dung HTML cho email
                const itemsHtml = orderItemsForEmail.map(item => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 5px;">
                           ${item.full_name} ${item.sku ? `(${item.sku})` : ''}
                        </td>
                        <td style="padding: 10px 5px; text-align: center;">${item.quantity}</td>
                        <td style="padding: 10px 5px; text-align: right;">${Number(item.price).toLocaleString('vi-VN')} VND</td>
                        <td style="padding: 10px 5px; text-align: right;">${(Number(item.price) * item.quantity).toLocaleString('vi-VN')} VND</td>
                    </tr>
                `).join('');

                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
                        <h2 style="color: #0056b3; text-align: center;">Cảm ơn bạn đã đặt hàng tại ${SHOP_INFO.from_name}!</h2>
                        <p>Xin chào ${customerNameForEmail},</p>
                        <p>Đơn hàng <strong style="color: #0056b3;">#${newOrder.order_number}</strong> của bạn đã được chúng tôi tiếp nhận vào lúc ${new Date(newOrder.order_date).toLocaleString('vi-VN')}.</p>
                        <p>Chúng tôi sẽ xử lý ${newOrder.payment_method?.toLowerCase() === 'cod' ? 'và liên hệ xác nhận ' : ''}đơn hàng của bạn trong thời gian sớm nhất.</p>

                        <h3 style="border-bottom: 2px solid #0056b3; padding-bottom: 5px; margin-top: 25px;">Chi tiết đơn hàng:</h3>
                        <p><strong>Người nhận:</strong> ${newOrder.recipient_name}</p>
                        <p><strong>Địa chỉ giao hàng:</strong> ${newOrder.shipping_address}</p>
                        <p><strong>Điện thoại:</strong> ${newOrder.recipient_name}</p>
                        <p><strong>Phương thức thanh toán:</strong> ${newOrder.payment_method?.toUpperCase() ?? 'N/A'}</p>
                        ${newOrder.notes ? `<p><strong>Ghi chú:</strong> ${newOrder.notes}</p>` : ''}

                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; border: 1px solid #ddd;">
                            <thead style="background-color: #f2f2f2; text-align: left;">
                                <tr>
                                    <th style="padding: 12px 8px; border: 1px solid #ddd;">Sản phẩm</th>
                                    <th style="padding: 12px 8px; text-align: center; border: 1px solid #ddd;">Số lượng</th>
                                    <th style="padding: 12px 8px; text-align: right; border: 1px solid #ddd;">Đơn giá</th>
                                    <th style="padding: 12px 8px; text-align: right; border: 1px solid #ddd;">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot style="font-weight: bold; background-color: #f9f9f9;">
                                <tr><td colspan="3" style="padding: 10px 8px; text-align: right; border-top: 1px solid #ddd;">Tạm tính:</td><td style="padding: 10px 8px; text-align: right; border-top: 1px solid #ddd;">${Number(newOrder.subtotal).toLocaleString('vi-VN')} VND</td></tr>
                                <tr><td colspan="3" style="padding: 10px 8px; text-align: right;">Phí vận chuyển:</td><td style="padding: 10px 8px; text-align: right;">${Number(newOrder.shipping_fee).toLocaleString('vi-VN')} VND</td></tr>
                                <tr><td colspan="3" style="padding: 12px 8px; text-align: right; border-top: 1px solid #ddd; font-size: 1.1em;">Tổng cộng:</td><td style="padding: 12px 8px; text-align: right; border-top: 1px solid #ddd; font-size: 1.1em;">${Number(newOrder.total_amount).toLocaleString('vi-VN')} VND</td></tr>
                            </tfoot>
                        </table>

                        ${shipmentResultForEmail?.order_code ? `<p><strong>Mã vận đơn (GHN):</strong> ${shipmentResultForEmail.order_code}</p>` : ''}
                        ${shipmentResultForEmail?.expected_delivery_time ? `<p><strong>Thời gian giao dự kiến:</strong> ${new Date(shipmentResultForEmail.expected_delivery_time).toLocaleDateString('vi-VN')}</p>` : ''}

                        <p style="margin-top: 20px; font-size: 0.9em; color: #555;">Bạn có thể xem lại chi tiết đơn hàng tại [Link đến trang đơn hàng của tôi].</p>
                        <p style="margin-top: 25px;">Cảm ơn bạn đã tin tưởng và mua hàng!</p>
                        <p style="margin-top: 20px;">Trân trọng,<br/><strong>${SHOP_INFO.from_name}</strong></p>
                        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                        <p style="font-size: 0.8em; color: #999; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
                    </div>
                `;

                // Gọi hàm gửi email từ service
                await sendEmail({
                    to: customerEmail,
                    subject: emailSubject,
                    html: emailHtml
                });

            } catch (emailError) {
                console.error(`Gửi email xác nhận đơn hàng ${newOrder?.id} thất bại:`, emailError);
                // Không throw lỗi, chỉ log lại
            }
        }
        // --- KẾT THÚC GỬI EMAIL ---

        // 8. TRẢ KẾT QUẢ CHO CLIENT
        res.status(201).json({
            success: true,
            message: 'Đặt hàng và tạo đơn vận chuyển thành công!',
            order: newOrder, // Trả về thông tin đơn hàng đã tạo
            shipment: { // Trả về thông tin vận đơn cơ bản
                tracking_number: shipmentResultForEmail?.order_code, // Lấy từ biến đã lưu
                carrier: 'ghn',
                fee: shipmentResultForEmail?.total_fee,
                expected_delivery_time: shipmentResultForEmail?.expected_delivery_time
            },
            paymentUrl: paymentUrl, // Gửi URL về frontend để redirect nếu là VNPay/MoMo
        });

    } catch (error) {
        // Rollback transaction nếu chưa commit
        if (client && !(client as any)._ended) { // Kiểm tra client còn hoạt động không
             try { await client.query('ROLLBACK'); } catch (rbError) { console.error('Error rolling back client', rbError); }
        }

        // Ghi log lỗi chi tiết
        if (axios.isAxiosError(error)) {
            console.error("Place order error (Axios):", error.response?.data ?? error.message ?? error);
        } else if (error instanceof Error) {
            console.error("Place order error:", error.message, error.stack);
        } else {
            console.error("Place order error (unknown type):", error);
        }

        // Phản hồi lỗi cho client
        if (axios.isAxiosError(error) && error.response?.data?.message) {
             // Lỗi từ GHN hoặc MoMo (nếu axios được dùng trong momoService)
             return res.status(400).json({ message: `Lỗi từ cổng thanh toán/vận chuyển: ${error.response.data.message}` });
        }
        if (error instanceof Error) {
             // Lỗi nghiệp vụ (vd: hết hàng, sai địa chỉ)
             return res.status(400).json({ message: error.message });
        }
        // Chuyển lỗi không xác định cho middleware xử lý lỗi chung
        next(error);
    } finally {
        if (client) client.release(); // Luôn trả kết nối về pool
    }
};

/**
 * @description Khách hàng xem danh sách đơn hàng của mình.
 */
export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });
        }

        const orders = await OrderModel.findOrdersByCustomerId(customer.id);
        res.status(200).json(orders);
    } catch (error) {
        console.error("Get My Orders error:", error);
        next(error); // Chuyển lỗi cho middleware xử lý lỗi chung
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
        if (isNaN(orderId)) {
            return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});
        }

        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });
        }

        const orderDetails = await OrderModel.findOrderDetailsById(orderId);
        // Kiểm tra đơn hàng tồn tại VÀ thuộc về khách hàng này
        if (!orderDetails || orderDetails.customer_id !== customer.id) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền xem.' });
        }
        res.status(200).json(orderDetails);
    } catch (error) {
        console.error("Get My Order Details error:", error);
        next(error); // Chuyển lỗi cho middleware xử lý lỗi chung
    }
};

// ===================================
// == API DÀNH CHO QUẢN TRỊ (ADMIN)
// ===================================

/**
 * @description Admin xem tất cả đơn hàng trong hệ thống (có phân trang/lọc).
 */
export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const { status, search } = req.query;
        let query = `
            SELECT o.id, o.order_number, o.order_date, o.order_status, o.total_amount,
                   o.customer_name, o.customer_phone, o.payment_method, o.payment_status,
                   c.name as customer_real_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
        `;
        const params: any[] = [];
        let whereClauses: string[] = [];

        if (status) {
            params.push(status as string);
            whereClauses.push(`o.order_status = $${params.length}`);
        }
        if (search) {
             params.push(`%${String(search).toLowerCase()}%`); // Chuyển search thành string và lowercase
             const searchParamIndex = params.length;
             whereClauses.push(
               `(LOWER(o.order_number) ILIKE $${searchParamIndex} OR LOWER(o.customer_name) ILIKE $${searchParamIndex} OR o.customer_phone ILIKE $${searchParamIndex})`
             );
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ` ORDER BY o.order_date DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        let countQuery = `SELECT COUNT(*) FROM orders o`;
        let countParams: any[] = [];
        if (whereClauses.length > 0) {
             countQuery += ' WHERE ' + whereClauses.join(' AND ');
             countParams = params.slice(0, params.length - 2);
        }
        const totalResult = await pool.query(countQuery, countParams);
        const totalOrders = parseInt(totalResult.rows[0].count, 10);

        res.status(200).json({
            data: result.rows.map(row => ({
                ...row,
                total_amount: parseFloat(row.total_amount) // Chuyển đổi amount
            })),
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(totalOrders / limit),
                totalItems: totalOrders
            }
        });
    } catch(error) {
        console.error("Get All Orders error:", error);
        next(error); // Chuyển lỗi cho middleware xử lý lỗi chung
    }
};

/**
 * @description Admin xem chi tiết một đơn hàng bất kỳ, bao gồm items, history, shipment, payments.
 */
export const getOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orderIdParam = req.params.id;
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) {
            return res.status(400).json({ message: `ID đơn hàng không hợp lệ: ${orderIdParam}`});
        }

        const orderDetails = await OrderModel.findOrderDetailsById(orderId);
        if(!orderDetails) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
        }

        res.status(200).json(orderDetails);
    } catch (error) {
        console.error("Get Order Details error:", error);
        next(error); // Chuyển lỗi cho middleware xử lý lỗi chung
    }
};

/**
 * @description Admin cập nhật trạng thái đơn hàng (xác nhận COD, xử lý, giao, hủy...) và gửi email thông báo.
 */
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    let updatedOrder: Order | null = null; // Biến lưu đơn hàng đã cập nhật
    let customerEmailForUpdate: string | null = null; // Biến lưu email khách

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

        // Lấy email khách hàng TRƯỚC khi cập nhật (để chắc chắn có email nếu cần gửi)
        const customerEmailResult = await client.query('SELECT c.email FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.id = $1', [orderId]);
        customerEmailForUpdate = customerEmailResult.rows[0]?.email;

        // Gọi hàm model để xử lý cập nhật trạng thái và logic kho
        updatedOrder = await OrderModel.updateOrderStatusByAdmin(orderId, status, user.id, client);

        await client.query('COMMIT'); // Kết thúc Transaction

        // --- GỬI EMAIL THÔNG BÁO CẬP NHẬT TRẠNG THÁI (SAU KHI COMMIT) ---
        if (updatedOrder && customerEmailForUpdate) { // Chỉ gửi nếu có email và cập nhật thành công
            try {
                let subject = '';
                let htmlBody = '';
                // Xây dựng subject và body tùy theo trạng thái mới (status)
                 switch (status) {
                    case 'confirmed':
                        subject = `Đơn hàng #${updatedOrder.order_number} đã được xác nhận`;
                        htmlBody = `<p>Đơn hàng của bạn đã được ${SHOP_INFO.from_name} xác nhận và đang được chuẩn bị để giao đi.</p>`;
                        break;
                    case 'processing':
                         subject = `Đơn hàng #${updatedOrder.order_number} đang được xử lý`;
                         htmlBody = `<p>Chúng tôi đang chuẩn bị các sản phẩm trong đơn hàng của bạn.</p>`;
                         break;
                    case 'shipped':
                        const shipmentInfo = await pool.query('SELECT tracking_number, carrier_code FROM shipments WHERE order_id = $1', [updatedOrder.id]);
                        const trackingCode = shipmentInfo.rows[0]?.tracking_number;
                        const carrier = shipmentInfo.rows[0]?.carrier_code?.toUpperCase() || '';
                        subject = `Đơn hàng #${updatedOrder.order_number} đã được giao đi`;
                        htmlBody = `<p>Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển ${carrier}.</p>${trackingCode ? `<p>Mã vận đơn: <strong>${trackingCode}</strong></p><p>Bạn có thể dùng mã này để theo dõi hành trình đơn hàng.</p>` : ''}`;
                        break;
                    case 'completed':
                         subject = `Đơn hàng #${updatedOrder.order_number} đã giao thành công`;
                         htmlBody = `<p>Đơn hàng đã được giao thành công đến bạn. Cảm ơn bạn đã mua hàng tại ${SHOP_INFO.from_name}!</p>`;
                         break;
                    case 'cancelled':
                         subject = `Đơn hàng #${updatedOrder.order_number} đã bị hủy`;
                         // Có thể lấy lý do hủy từ history hoặc notes nếu cần chi tiết hơn
                         htmlBody = `<p>Đơn hàng của bạn đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ với chúng tôi qua số điện thoại ${SHOP_INFO.from_phone}.</p>`;
                         break;
                     // Không cần case 'pending' vì admin không chuyển về pending
                 }

                 if(subject && htmlBody) {
                    const fullHtml = `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
                            <h2 style="color: #0056b3; text-align: center;">Cập nhật trạng thái đơn hàng #${updatedOrder.order_number}</h2>
                            <p>Xin chào ${updatedOrder.account_customer_name},</p>
                            ${htmlBody}
                            <p style="margin-top: 20px;">Trân trọng,<br/><strong>${SHOP_INFO.from_name}</strong></p>
                             <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                            <p style="font-size: 0.8em; color: #999; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
                        </div>`;
                    await sendEmail({ to: customerEmailForUpdate, subject: subject, html: fullHtml });
                 }
            } catch(emailError) {
                 console.error(`Gửi email cập nhật trạng thái đơn hàng ${updatedOrder?.id} thất bại:`, emailError);
                 // Không làm gián đoạn quá trình trả response
            }
        } else if (updatedOrder && !customerEmailForUpdate) {
             console.warn(`Không tìm thấy email để gửi thông báo cập nhật trạng thái cho đơn hàng ID: ${updatedOrder.id}`);
        }
        // --- KẾT THÚC GỬI EMAIL ---

        // Trả về kết quả thành công
        res.status(200).json({
            message: 'Cập nhật trạng thái đơn hàng thành công.',
            order: updatedOrder,
        });

    } catch (error) {
        // Rollback transaction nếu chưa commit
        if (client && !(client as any)._ended) {
            try { await client.query('ROLLBACK'); } catch (rbError) { console.error('Error rolling back client', rbError); }
        }
        console.error("Update order status error:", error);
        // Trả về lỗi nghiệp vụ
        if (error instanceof Error) {
             return res.status(400).json({ message: error.message });
        }
        // Chuyển lỗi khác
        next(error);
    } finally {
        if (client) client.release(); // Luôn trả kết nối
    }
};
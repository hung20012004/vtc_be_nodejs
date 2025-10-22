import { PoolClient } from 'pg';
import { Order } from '../../types/orders/order.type'; // Đảm bảo đường dẫn đúng
import * as CustomerAddressModel from './../locations/customer_address.model'; // Đảm bảo đường dẫn đúng
import pool from '../../../config/db'; // Đảm bảo đường dẫn đúng

// Interface cho dữ liệu đầu vào khi đặt hàng (lấy từ controller)
interface PlaceOrderData {
    addressId: number;
    // Cần cả service_id và service_type_id để khớp với controller và GHN payload
    shippingOption: { fee: number; service_id: number; service_type_id: number };
    paymentMethod: string;
    notes?: string;
    // Không cần 'items' ở đây nữa
}

/**
 * @description Tạo đơn hàng mới từ giỏ hàng của khách hàng, tạo chi tiết đơn hàng,
 * trừ kho nếu cần, ghi lịch sử, và xóa giỏ hàng (nếu thanh toán thành công).
 * Phải được gọi bên trong một transaction.
 * @param customerId ID của khách hàng đặt hàng.
 * @param data Dữ liệu đơn hàng từ controller (không bao gồm items).
 * @param client Kết nối database client cho transaction.
 * @returns Thông tin đơn hàng mới, chi tiết các sản phẩm, địa chỉ giao hàng, tổng cân nặng, tổng tiền.
 */
export const placeOrder = async (customerId: number, data: PlaceOrderData, client: PoolClient) => {
    const { addressId, shippingOption, paymentMethod, notes } = data;

    // --- LẤY ITEMS TỪ GIỎ HÀNG (carts) ---
    const cartResult = await client.query(
        // Chọn variant_id và quantity từ giỏ hàng của customer
        'SELECT variant_id, quantity FROM carts WHERE customer_id = $1 FOR UPDATE', // FOR UPDATE để khóa các dòng này trong transaction
        [customerId]
    );
    const cartItems = cartResult.rows;
    if (!cartItems || cartItems.length === 0) {
        throw new Error('Giỏ hàng trống. Không thể đặt hàng.');
    }
    // ------------------------------------

    const variantIds = cartItems.map(item => item.variant_id);

    // Lấy thông tin chi tiết các variant từ bảng product_variants và products
    const variantResult = await client.query(
        `SELECT v.id as variant_id, p.name || COALESCE(' - ' || v.name, '') as full_name,
                v.price, v.weight, v.length, v.width, v.height, -- Lấy thêm kích thước
                p.id as product_id, v.sku
         FROM product_variants v JOIN products p ON v.product_id = p.id
         WHERE v.id = ANY($1::int[])`,
        [variantIds]
    );
    // Tạo map để dễ dàng truy cập thông tin variant bằng ID
    const variantMap = new Map(variantResult.rows.map(v => [v.variant_id, v]));

    let subtotal = 0; // Tổng tiền hàng
    let totalWeight = 0; // Tổng cân nặng (gram)
    const orderItemsInfo = []; // Mảng chứa thông tin chi tiết các item cho đơn hàng

    // --- KIỂM TRA TỒN KHO VÀ TÍNH TOÁN ---
    for (const item of cartItems) {
        const variant = variantMap.get(item.variant_id);

        // Kiểm tra tồn kho tại kho tổng (branch_id = 0) và khóa dòng đó
        const stockResult = await client.query(
            'SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE',
            [item.variant_id]
        );
        const stockQuantity = stockResult.rows[0]?.quantity || 0;

        if (!variant) {
            // Lỗi này không nên xảy ra nếu database nhất quán, nhưng vẫn kiểm tra
            throw new Error(`Sản phẩm không hợp lệ trong giỏ hàng (variant_id: ${item.variant_id}).`);
        }
        if (stockQuantity < item.quantity) {
            throw new Error(`Sản phẩm '${variant.full_name}' không đủ số lượng tồn kho (cần ${item.quantity}, chỉ còn ${stockQuantity}). Vui lòng cập nhật giỏ hàng.`);
        }

        subtotal += Number(variant.price) * item.quantity;
        totalWeight += (Number(variant.weight) || 100) * item.quantity; // Ước tính 100g nếu weight là null/0
        orderItemsInfo.push({ ...variant, quantity: item.quantity }); // Lưu thông tin đầy đủ để tạo order_items và payload GHN
    }
    // Tổng tiền cuối cùng = tiền hàng + phí ship
    const totalAmount = subtotal + shippingOption.fee;

    // Xác định trạng thái ban đầu của đơn hàng và thanh toán
    // Đơn hàng luôn bắt đầu là 'pending' để chờ thanh toán hoặc xác nhận COD
    const initialStatus: Order['order_status'] = 'pending';
    const initialPaymentStatus: Order['payment_status'] = 'pending';

    // Lấy thông tin địa chỉ giao hàng chi tiết
    const shippingAddress = await CustomerAddressModel.findAddressDetailsById(addressId, client);
    // Kiểm tra địa chỉ có tồn tại và thuộc về khách hàng đang đặt không
    if (!shippingAddress || shippingAddress.customer_id !== customerId) {
        throw new Error('Địa chỉ giao hàng không hợp lệ hoặc không thuộc về bạn.');
    }
    // Tạo chuỗi địa chỉ đầy đủ
    const fullAddressString = `${shippingAddress.address}, ${shippingAddress.ward_name}, ${shippingAddress.district_name}, ${shippingAddress.province_name}`;
    // Tạo mã đơn hàng duy nhất
    const orderNumber = `FA-${Date.now()}-${customerId}`;

    // --- TẠO BẢN GHI ĐƠN HÀNG MỚI (orders) ---
    const orderResult = await client.query(
        `INSERT INTO orders (
            customer_id, order_number, customer_name, customer_phone,
            shipping_address, subtotal, shipping_fee, total_amount,
            payment_method, order_status, payment_status, notes,
            shipping_province, shipping_district, shipping_ward
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`, // Trả về toàn bộ thông tin đơn hàng vừa tạo
        [
            customerId, orderNumber, shippingAddress.name, shippingAddress.phone,
            fullAddressString, subtotal, shippingOption.fee, totalAmount,
            paymentMethod, initialStatus, initialPaymentStatus, notes,
            shippingAddress.province_name, shippingAddress.district_name, shippingAddress.ward_name
        ]
    );
    const newOrder: Order = orderResult.rows[0];

    // --- TẠO CÁC BẢN GHI CHI TIẾT ĐƠN HÀNG (order_items) ---
    const itemInsertPromises = orderItemsInfo.map(item =>
        client.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_sku, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newOrder.id, item.product_id, item.variant_id, item.full_name, item.sku, item.quantity, item.price]
        )
    );
    await Promise.all(itemInsertPromises); // Chạy song song để tăng tốc

    // --- KHÔNG TRỪ KHO Ở BƯỚC NÀY ---
    // Kho sẽ được trừ khi:
    // 1. Thanh toán online thành công (xử lý ở hàm confirmOnlinePaymentAndUpdateStock).
    // 2. Admin xác nhận đơn COD (xử lý ở hàm updateOrderStatusByAdmin).

    // --- GHI LẠI LỊCH SỬ TRẠNG THÁI ĐẦU TIÊN ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, to_status, notes, changed_by) VALUES ($1, $2, $3, $4)',
        [newOrder.id, initialStatus, 'Đơn hàng được tạo thành công.', null] // changed_by là null vì đây là hành động của khách
    );

    // --- KHÔNG XÓA GIỎ HÀNG Ở BƯỚC NÀY ---
    // Giỏ hàng sẽ được xóa sau khi thanh toán thành công hoặc admin xác nhận COD.

    // --- TRẢ VỀ KẾT QUẢ CHO CONTROLLER ---
    // Trả về cả orderItemsInfo để controller dùng tạo payload GHN
    return { newOrder, orderItems: orderItemsInfo, shippingAddress, totalWeight, totalAmount };
};

/**
 * @description Xác nhận thanh toán online thành công (sau khi IPN được xác thực),
 * cập nhật trạng thái đơn hàng/thanh toán, trừ kho, ghi lịch sử, và xóa giỏ hàng.
 * @param orderId ID của đơn hàng cần xác nhận.
 * @param transactionId Mã giao dịch từ cổng thanh toán (vd: VNPay Transaction No).
 * @param client Kết nối database client cho transaction.
 * @returns Thông tin đơn hàng sau khi đã cập nhật.
 */
export const confirmOnlinePaymentAndUpdateStock = async (orderId: number, transactionId: string, client: PoolClient): Promise<Order> => {
    // 1. Lấy thông tin đơn hàng hiện tại và khóa dòng đó để tránh xung đột
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
        throw new Error(`Không tìm thấy đơn hàng với ID: ${orderId} để xác nhận thanh toán.`);
    }
    const order: Order = orderResult.rows[0];

    // 2. Chỉ xử lý nếu đơn hàng đang ở trạng thái 'pending' và thanh toán cũng 'pending'
    if (order.order_status !== 'pending' || order.payment_status !== 'pending') {
        console.warn(`Đơn hàng ${orderId} đã được xử lý thanh toán trước đó hoặc có trạng thái không hợp lệ (order: ${order.order_status}, payment: ${order.payment_status}). Không thực hiện cập nhật.`);
        return order; // Trả về trạng thái hiện tại nếu đã xử lý rồi
    }

    // --- 3. TRỪ KHO ---
    const itemsResult = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    const stockUpdatePromises = itemsResult.rows.map(async item => {
        // Kiểm tra lại tồn kho một lần nữa trước khi trừ
        const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
        const currentStock = stockCheck.rows[0]?.quantity || 0;
        if (currentStock < item.quantity) {
             // Nếu hết hàng ngay lúc này -> Ném lỗi để rollback transaction
             throw new Error(`Hết hàng cho sản phẩm (variant_id: ${item.variant_id}) trong lúc xác nhận thanh toán. Đơn hàng không thể hoàn tất.`);
             // Cân nhắc: Có thể thêm logic hoàn tiền tự động ở controller nếu có thể
        }
        // Thực hiện trừ kho
        return client.query(
            'UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2',
            [item.quantity, item.variant_id]
        );
    });
    // Đảm bảo tất cả các cập nhật kho thành công, nếu có lỗi sẽ nhảy vào catch của controller
    await Promise.all(stockUpdatePromises);

    // --- 4. CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG VÀ THANH TOÁN ---
    const updatedOrderResult = await client.query(
        'UPDATE orders SET order_status = $1, payment_status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        ['confirmed', 'paid', orderId] // Chuyển sang 'confirmed' và 'paid'
    );

    // --- 5. CẬP NHẬT BẢN GHI PAYMENT ---
    // Ghi lại mã giao dịch và đánh dấu là hoàn thành
    await client.query(
        'UPDATE payments SET status = $1, transaction_id = $2, payment_date = NOW(), updated_at = NOW() WHERE order_id = $3 AND status = $4',
        ['completed', transactionId, orderId, 'pending']
    );

    // --- 6. GHI LỊCH SỬ TRẠNG THÁI ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, from_status, to_status, notes, changed_by) VALUES ($1, $2, $3, $4, $5)',
        [orderId, 'pending', 'confirmed', `Thanh toán ${order.payment_method} thành công (Mã GD cổng TT: ${transactionId})`, null] // Hệ thống tự động cập nhật
    );

    // --- 7. XÓA GIỎ HÀNG SAU KHI THANH TOÁN THÀNH CÔNG ---
    await client.query('DELETE FROM carts WHERE customer_id = $1', [order.customer_id]);

    return updatedOrderResult.rows[0]; // Trả về đơn hàng đã cập nhật
};


/**
 * @description Admin cập nhật trạng thái đơn hàng (xác nhận COD, xử lý, giao, hủy...).
 * Bao gồm logic trừ/hoàn kho và ghi lịch sử.
 * @param orderId ID của đơn hàng cần cập nhật.
 * @param newStatus Trạng thái mới.
 * @param changedBy ID của người dùng (admin/nhân viên) thực hiện thay đổi.
 * @param client Kết nối database client cho transaction.
 * @returns Thông tin đơn hàng sau khi đã cập nhật.
 */
export const updateOrderStatusByAdmin = async (orderId: number, newStatus: Order['order_status'], changedBy: number, client: PoolClient): Promise<Order> => {
    // Lấy thông tin đơn hàng hiện tại và khóa dòng đó
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
        throw new Error(`Không tìm thấy đơn hàng với ID: ${orderId}.`);
    }
    const currentOrder: Order = orderResult.rows[0];

    // --- KIỂM TRA TÍNH HỢP LỆ CỦA VIỆC CHUYỂN TRẠNG THÁI ---
    const validTransitions: { [key in Order['order_status']]?: Order['order_status'][] } = {
        'pending': ['confirmed', 'cancelled'], // Chỉ cho đơn COD hoặc đơn online bị lỗi chờ admin xử lý
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['completed', 'cancelled'], // Cho phép hủy cả khi đang ship nếu cần
        // 'completed' và 'cancelled' là trạng thái cuối
    };

    if (!validTransitions[currentOrder.order_status]?.includes(newStatus)) {
        throw new Error(`Không thể chuyển trạng thái đơn hàng từ '${currentOrder.order_status}' sang '${newStatus}'.`);
    }

    // Lấy danh sách sản phẩm trong đơn hàng
    const itemsResult = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    const orderItems = itemsResult.rows;

    // --- XỬ LÝ LOGIC KHO ---

    // TRỪ KHO KHI ADMIN XÁC NHẬN ĐƠN HÀNG COD
    // Chỉ thực hiện khi đơn là COD, đang pending và chuyển sang confirmed
    if ((currentOrder.payment_method || '').toLowerCase() === 'cod' && currentOrder.order_status === 'pending' && newStatus === 'confirmed') {
        const stockUpdatePromises = orderItems.map(async item => {
            // Kiểm tra lại tồn kho trước khi trừ
            const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
            const currentStock = stockCheck.rows[0]?.quantity || 0;
            if (currentStock < item.quantity) {
                throw new Error(`Không thể xác nhận đơn hàng. Sản phẩm (variant_id: ${item.variant_id}) đã hết hàng hoặc không đủ số lượng.`);
            }
            // Trừ kho
            return client.query(
                'UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2',
                [item.quantity, item.variant_id]
            );
        });
        await Promise.all(stockUpdatePromises); // Đảm bảo trừ kho thành công

        // Cập nhật trạng thái thanh toán của đơn COD thành 'paid' khi admin xác nhận (vì sẽ thu tiền sau)
        // Hoặc giữ 'pending' tùy nghiệp vụ. Ở đây ví dụ cập nhật thành 'paid'.
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['paid', orderId]);

        // Xóa giỏ hàng khi admin xác nhận COD thành công
        await client.query('DELETE FROM carts WHERE customer_id = $1', [currentOrder.customer_id]);
    }

    // HOÀN KHO KHI ADMIN HỦY ĐƠN HÀNG ĐÃ TRỪ KHO
    // Các trạng thái đã có thể bị trừ kho bao gồm 'confirmed' và 'processing'
    if (['confirmed', 'processing'].includes(currentOrder.order_status) && newStatus === 'cancelled') {
        const stockRevertPromises = orderItems.map(item =>
            client.query(
                'UPDATE branch_inventories SET quantity = quantity + $1 WHERE branch_id = 0 AND variant_id = $2',
                [item.quantity, item.variant_id]
            )
        );
        await Promise.all(stockRevertPromises);
        // Cập nhật trạng thái thanh toán thành 'refunded' hoặc 'failed' nếu cần
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['refunded', orderId]); // Ví dụ
        await client.query('UPDATE payments SET status = $1 WHERE order_id = $2', ['refunded', orderId]); // Ví dụ
    }
    // Lưu ý: Logic hoàn kho/hoàn tiền khi hủy đơn 'shipped' phức tạp hơn, cần xem xét nghiệp vụ cụ thể.

    // --- CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG ---
    await client.query('UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2', [newStatus, orderId]);

    // --- GHI LẠI LỊCH SỬ THAY ĐỔI ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, from_status, to_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
        [orderId, currentOrder.order_status, newStatus, changedBy, 'Admin cập nhật trạng thái']
    );

    // --- LẤY LẠI THÔNG TIN ĐƠN HÀNG ĐÃ CẬP NHẬT ĐỂ TRẢ VỀ ---
    const updatedOrderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return updatedOrderResult.rows[0];
};


// ===================================
// == CÁC HÀM LẤY DỮ LIỆU (READ)
// ===================================

/**
 * @description Lấy danh sách đơn hàng của một khách hàng cụ thể.
 */
export const findOrdersByCustomerId = async (customerId: number): Promise<Order[]> => {
    const result = await pool.query(
        `SELECT
            o.id, o.order_number, o.order_date, o.order_status, o.total_amount, o.payment_method, o.payment_status,
            (SELECT COALESCE(json_agg(json_build_object(
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'image', COALESCE(pv.image, p.images->>'thumbnail')
               )), '[]'::json)
             FROM order_items oi
             LEFT JOIN product_variants pv ON oi.variant_id = pv.id
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = o.id
            ) as items
         FROM orders o
         WHERE o.customer_id = $1
         ORDER BY o.order_date DESC`,
        [customerId]
    );
    // Chuyển đổi total_amount sang number nếu cần
    return result.rows.map(row => ({
        ...row,
        total_amount: parseFloat(row.total_amount)
    }));
};

/**
 * @description Lấy thông tin chi tiết của một đơn hàng, bao gồm items, lịch sử và vận đơn.
 */
export const findOrderDetailsById = async (orderId: number): Promise<(Order & { items: any[], history: any[], shipment: any, payments: any[] }) | null> => {
    // Sử dụng Promise.all để chạy các truy vấn song song
    const orderPromise = pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const itemsPromise = pool.query(
        `SELECT oi.*, COALESCE(pv.image, p.images->>'thumbnail') as image
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.variant_id = pv.id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1 ORDER BY oi.id ASC`,
        [orderId]
    );
    const historyPromise = pool.query(
        `SELECT h.*, u.name as changed_by_name
         FROM order_status_histories h
         LEFT JOIN users u ON h.changed_by = u.id
         WHERE h.order_id = $1 ORDER BY h.created_at ASC`,
        [orderId]
    );
    const shipmentPromise = pool.query('SELECT * FROM shipments WHERE order_id = $1', [orderId]);
    const paymentPromise = pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]); // Lấy cả payment


    const [orderResult, itemsResult, historyResult, shipmentResult, paymentResult] = await Promise.all([
        orderPromise,
        itemsPromise,
        historyPromise,
        shipmentPromise,
        paymentPromise
    ]);

    // Nếu không tìm thấy đơn hàng chính, trả về null
    if (orderResult.rows.length === 0) {
        return null;
    }

    // Kết hợp kết quả
    return {
        ...orderResult.rows[0],       // Thông tin đơn hàng chính
        items: itemsResult.rows.map(item => ({ // Chuyển đổi giá về number nếu cần
            ...item,
            unit_price: parseFloat(item.unit_price)
        })),
        history: historyResult.rows,  // Lịch sử thay đổi trạng thái
        shipment: shipmentResult.rows[0] || null, // Thông tin vận đơn (nếu có)
        payments: paymentResult.rows.map(p => ({ // Thông tin thanh toán
            ...p,
            amount: parseFloat(p.amount)
        }))
    };
};
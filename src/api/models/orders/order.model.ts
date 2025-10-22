import { PoolClient } from 'pg';
import { Order } from '../../types/orders/order.type'; // Đảm bảo đường dẫn đúng
import * as CustomerAddressModel from './../locations/customer_address.model'; // Đảm bảo đường dẫn đúng
import pool from '../../../config/db'; // Đảm bảo đường dẫn đúng

// Interface cho dữ liệu đầu vào khi đặt hàng (lấy từ controller)
interface PlaceOrderData {
    addressId: number;
    shippingOption: { fee: number; service_id: number; service_type_id: number };
    paymentMethod: string;
    notes?: string;
}

/**
 * @description Tạo đơn hàng mới từ giỏ hàng, xóa giỏ hàng nếu là COD.
 */
export const placeOrder = async (customerId: number, data: PlaceOrderData, client: PoolClient) => {
    const { addressId, shippingOption, paymentMethod, notes } = data;

    // --- LẤY ITEMS TỪ GIỎ HÀNG (carts) ---
    const cartResult = await client.query(
        'SELECT variant_id, quantity FROM carts WHERE customer_id = $1 FOR UPDATE',
        [customerId]
    );
    const cartItems = cartResult.rows;
    if (!cartItems || cartItems.length === 0) {
        throw new Error('Giỏ hàng trống. Không thể đặt hàng.');
    }

    const variantIds = cartItems.map(item => item.variant_id);

    // --- Lấy thông tin chi tiết các variant ---
    const variantResult = await client.query(
        `SELECT v.id as variant_id, p.name || COALESCE(' - ' || v.name, '') as full_name,
                v.price, v.weight, v.length, v.width, v.height,
                p.id as product_id, v.sku
         FROM product_variants v JOIN products p ON v.product_id = p.id
         WHERE v.id = ANY($1::int[])`,
        [variantIds]
    );
    const variantMap = new Map(variantResult.rows.map(v => [v.variant_id, v]));

    let subtotal = 0;
    let totalWeight = 0;
    const orderItemsInfo = [];

    // --- KIỂM TRA TỒN KHO VÀ TÍNH TOÁN ---
    for (const item of cartItems) {
        const variant = variantMap.get(item.variant_id);
        const stockResult = await client.query(
            'SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE',
            [item.variant_id]
        );
        const stockQuantity = stockResult.rows[0]?.quantity || 0;

        if (!variant) {
            throw new Error(`Sản phẩm không hợp lệ trong giỏ hàng (variant_id: ${item.variant_id}).`);
        }
        if (stockQuantity < item.quantity) {
            throw new Error(`Sản phẩm '${variant.full_name}' không đủ số lượng tồn kho (cần ${item.quantity}, chỉ còn ${stockQuantity}). Vui lòng cập nhật giỏ hàng.`);
        }

        subtotal += Number(variant.price) * item.quantity;
        totalWeight += (Number(variant.weight) || 100) * item.quantity;
        orderItemsInfo.push({ ...variant, quantity: item.quantity });
    }
    const totalAmount = subtotal + shippingOption.fee;

    const initialStatus: Order['order_status'] = 'pending'; // Luôn pending ban đầu
    const initialPaymentStatus: Order['payment_status'] = 'pending';

    const shippingAddress = await CustomerAddressModel.findAddressDetailsById(addressId, client);
    if (!shippingAddress || shippingAddress.customer_id !== customerId) {
        throw new Error('Địa chỉ giao hàng không hợp lệ hoặc không thuộc về bạn.');
    }
    const fullAddressString = `${shippingAddress.address}, ${shippingAddress.ward_name}, ${shippingAddress.district_name}, ${shippingAddress.province_name}`;
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
         RETURNING *`,
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
    await Promise.all(itemInsertPromises);

    // --- KHÔNG TRỪ KHO Ở BƯỚC NÀY ---

    // --- GHI LẠI LỊCH SỬ TRẠNG THÁI ĐẦU TIÊN ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, to_status, notes, changed_by) VALUES ($1, $2, $3, $4)',
        [newOrder.id, initialStatus, 'Đơn hàng được tạo thành công.', null]
    );

    // --- [SỬA ĐỔI] XÓA GIỎ HÀNG NGAY NẾU LÀ COD ---
    if (paymentMethod.toLowerCase() === 'cod') {
        await client.query('DELETE FROM carts WHERE customer_id = $1', [customerId]);
        console.log(`Cleared cart for customer ${customerId} after placing COD order ${newOrder.id}`);
    }
    // Giỏ hàng của đơn online sẽ bị xóa trong hàm confirmOnlinePaymentAndUpdateStock

    // --- TRẢ VỀ KẾT QUẢ CHO CONTROLLER ---
    return { newOrder, orderItems: orderItemsInfo, shippingAddress, totalWeight, totalAmount };
};

/**
 * @description Xác nhận thanh toán online thành công, cập nhật trạng thái và trừ kho.
 */
export const confirmOnlinePaymentAndUpdateStock = async (orderId: number, transactionId: string, client: PoolClient): Promise<Order> => {
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
        throw new Error(`Không tìm thấy đơn hàng với ID: ${orderId} để xác nhận thanh toán.`);
    }
    const order: Order = orderResult.rows[0];

    if (order.order_status !== 'pending' || order.payment_status !== 'pending') {
        console.warn(`Đơn hàng ${orderId} đã được xử lý thanh toán trước đó hoặc có trạng thái không hợp lệ. Không thực hiện cập nhật.`);
        return order;
    }

    // --- TRỪ KHO ---
    const itemsResult = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    const stockUpdatePromises = itemsResult.rows.map(async item => {
        const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
        const currentStock = stockCheck.rows[0]?.quantity || 0;
        if (currentStock < item.quantity) {
             throw new Error(`Hết hàng cho sản phẩm (variant_id: ${item.variant_id}) trong lúc xác nhận thanh toán. Đơn hàng không thể hoàn tất.`);
        }
        return client.query(
            'UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2',
            [item.quantity, item.variant_id]
        );
    });
    await Promise.all(stockUpdatePromises);

    // --- CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG VÀ THANH TOÁN ---
    const updatedOrderResult = await client.query(
        'UPDATE orders SET order_status = $1, payment_status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        ['confirmed', 'paid', orderId]
    );

    // --- CẬP NHẬT BẢN GHI PAYMENT ---
    await client.query(
        'UPDATE payments SET status = $1, transaction_id = $2, payment_date = NOW(), updated_at = NOW() WHERE order_id = $3 AND status = $4',
        ['completed', transactionId, orderId, 'pending']
    );

    // --- GHI LỊCH SỬ TRẠNG THÁI ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, from_status, to_status, notes, changed_by) VALUES ($1, $2, $3, $4, $5)',
        [orderId, 'pending', 'confirmed', `Thanh toán ${order.payment_method} thành công (Mã GD cổng TT: ${transactionId})`, null]
    );

    // --- XÓA GIỎ HÀNG SAU KHI THANH TOÁN THÀNH CÔNG ---
    await client.query('DELETE FROM carts WHERE customer_id = $1', [order.customer_id]);
    console.log(`Cleared cart for customer ${order.customer_id} after successful online payment for order ${orderId}`);


    return updatedOrderResult.rows[0];
};


/**
 * @description Admin cập nhật trạng thái đơn hàng (xác nhận COD, xử lý, giao, hủy...).
 */
export const updateOrderStatusByAdmin = async (orderId: number, newStatus: Order['order_status'], changedBy: number, client: PoolClient): Promise<Order> => {
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
        throw new Error(`Không tìm thấy đơn hàng với ID: ${orderId}.`);
    }
    const currentOrder: Order = orderResult.rows[0];

    const validTransitions: { [key in Order['order_status']]?: Order['order_status'][] } = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['completed', 'cancelled'],
    };

    if (!validTransitions[currentOrder.order_status]?.includes(newStatus)) {
        throw new Error(`Không thể chuyển trạng thái đơn hàng từ '${currentOrder.order_status}' sang '${newStatus}'.`);
    }

    const itemsResult = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    const orderItems = itemsResult.rows;

    // --- XỬ LÝ LOGIC KHO ---
    // TRỪ KHO KHI ADMIN XÁC NHẬN ĐƠN HÀNG COD
    if ((currentOrder.payment_method || '').toLowerCase() === 'cod' && currentOrder.order_status === 'pending' && newStatus === 'confirmed') {
        const stockUpdatePromises = orderItems.map(async item => {
            const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
            const currentStock = stockCheck.rows[0]?.quantity || 0;
            if (currentStock < item.quantity) {
                throw new Error(`Không thể xác nhận đơn hàng. Sản phẩm (variant_id: ${item.variant_id}) đã hết hàng hoặc không đủ số lượng.`);
            }
            return client.query(
                'UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2',
                [item.quantity, item.variant_id]
            );
        });
        await Promise.all(stockUpdatePromises);

        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['paid', orderId]);

        // --- [XÓA BỎ] Lệnh xóa giỏ hàng ở đây ---
        // await client.query('DELETE FROM carts WHERE customer_id = $1', [currentOrder.customer_id]);
    }

    // HOÀN KHO KHI ADMIN HỦY ĐƠN HÀNG ĐÃ TRỪ KHO
    if (['confirmed', 'processing'].includes(currentOrder.order_status) && newStatus === 'cancelled') {
        const stockRevertPromises = orderItems.map(item =>
            client.query(
                'UPDATE branch_inventories SET quantity = quantity + $1 WHERE branch_id = 0 AND variant_id = $2',
                [item.quantity, item.variant_id]
            )
        );
        await Promise.all(stockRevertPromises);
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['refunded', orderId]);
        await client.query('UPDATE payments SET status = $1 WHERE order_id = $2', ['refunded', orderId]);
    }

    // --- CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG ---
    await client.query('UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2', [newStatus, orderId]);

    // --- GHI LẠI LỊCH SỬ THAY ĐỔI ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, from_status, to_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
        [orderId, currentOrder.order_status, newStatus, changedBy, 'Admin cập nhật trạng thái']
    );

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
                'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price,
                'image', COALESCE(pv.image, p.images->>'thumbnail') )), '[]'::json)
             FROM order_items oi
             LEFT JOIN product_variants pv ON oi.variant_id = pv.id
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = o.id ) as items
         FROM orders o
         WHERE o.customer_id = $1
         ORDER BY o.order_date DESC`,
        [customerId]
    );
    return result.rows.map(row => ({
        ...row,
        total_amount: parseFloat(row.total_amount)
    }));
};

/**
 * @description Lấy thông tin chi tiết của một đơn hàng, bao gồm items, lịch sử, vận đơn, thanh toán.
 */
export const findOrderDetailsById = async (orderId: number): Promise<(Order & { items: any[], history: any[], shipment: any, payments: any[] }) | null> => {
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
    const paymentPromise = pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);


    const [orderResult, itemsResult, historyResult, shipmentResult, paymentResult] = await Promise.all([
        orderPromise, itemsPromise, historyPromise, shipmentPromise, paymentPromise
    ]);

    if (orderResult.rows.length === 0) return null;

    return {
        ...orderResult.rows[0],
        items: itemsResult.rows.map(item => ({
            ...item,
            unit_price: parseFloat(item.unit_price)
        })),
        history: historyResult.rows,
        shipment: shipmentResult.rows[0] || null,
        payments: paymentResult.rows.map(p => ({
            ...p,
            amount: parseFloat(p.amount)
        }))
    };
};
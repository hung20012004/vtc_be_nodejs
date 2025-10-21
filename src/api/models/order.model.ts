import { PoolClient } from 'pg';
import { Order } from '../types/order.type';
import * as CustomerAddressModel from './customer_address.model';
import pool from '../../config/db';

interface PlaceOrderData {
    addressId: number;
    shippingOption: { fee: number };
    paymentMethod: string;
    notes?: string;
    items: { variant_id: number, quantity: number }[];
}

/**
 * Tạo đơn hàng, chi tiết đơn hàng, và xử lý logic ban đầu.
 */
export const placeOrder = async (customerId: number, data: PlaceOrderData, client: PoolClient) => {
    const { addressId, shippingOption, paymentMethod, notes, items } = data;
    if (!items || items.length === 0) throw new Error('Giỏ hàng trống.');

    const variantIds = items.map(item => item.variant_id);
    const variantResult = await client.query(
        `SELECT v.id as variant_id, p.name || COALESCE(' - ' || v.name, '') as full_name, v.price, v.weight,
                p.id as product_id, v.sku
         FROM product_variants v JOIN products p ON v.product_id = p.id
         WHERE v.id = ANY($1::int[])`,
        [variantIds]
    );
    const variantMap = new Map(variantResult.rows.map(v => [v.variant_id, v]));

    let subtotal = 0;
    let totalWeight = 0;
    const orderItemsInfo = [];

    for (const item of items) {
        const variant = variantMap.get(item.variant_id);
        const stockResult = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
        const stockQuantity = stockResult.rows[0]?.quantity || 0;
        
        if (!variant) throw new Error(`Sản phẩm không tồn tại.`);
        if (stockQuantity < item.quantity) throw new Error(`Sản phẩm '${variant.full_name}' không đủ số lượng tồn kho.`);
        
        subtotal += Number(variant.price) * item.quantity;
        totalWeight += (variant.weight || 100) * item.quantity;
        orderItemsInfo.push({ ...variant, quantity: item.quantity });
    }
    const totalAmount = subtotal + shippingOption.fee;
    
    const initialStatus = paymentMethod.toLowerCase() === 'cod' ? 'pending' : 'confirmed';
    const initialPaymentStatus = paymentMethod.toLowerCase() === 'cod' ? 'pending' : 'pending';

    const shippingAddress = await CustomerAddressModel.findAddressDetailsById(addressId, client);
    if (!shippingAddress) throw new Error('Địa chỉ giao hàng không hợp lệ.');
    const fullAddressString = `${shippingAddress.address}, ${shippingAddress.ward_name}, ${shippingAddress.district_name}, ${shippingAddress.province_name}`;
    const orderNumber = `FA-${Date.now()}`;

    const orderResult = await client.query(
        `INSERT INTO orders (customer_id, order_number, customer_name, customer_phone, shipping_address, subtotal, shipping_fee, total_amount, payment_method, order_status, payment_status, notes, shipping_province, shipping_district, shipping_ward)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
        [
            customerId, orderNumber, shippingAddress.name, shippingAddress.phone, fullAddressString,
            subtotal, shippingOption.fee, totalAmount, paymentMethod, initialStatus, initialPaymentStatus, notes,
            shippingAddress.province_name, shippingAddress.district_name, shippingAddress.ward_name
        ]
    );
    const newOrder = orderResult.rows[0];

    for (const item of orderItemsInfo) {
        await client.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_sku, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newOrder.id, item.product_id, item.variant_id, item.full_name, item.sku, item.quantity, item.price]
        );
    }
    
    if (initialStatus === 'confirmed') {
        for (const item of orderItemsInfo) {
            await client.query('UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2', [item.quantity, item.variant_id]);
        }
    }

    await client.query('INSERT INTO order_status_histories (order_id, to_status, notes) VALUES ($1, $2, $3)', [newOrder.id, initialStatus, 'Đơn hàng được tạo thành công.']);
    await client.query('DELETE FROM carts WHERE customer_id = $1 AND variant_id = ANY($2::int[])', [customerId, variantIds]);
    
    return { newOrder, orderItems: orderItemsInfo, shippingAddress, totalWeight, totalAmount };
};

/**
 * Cập nhật trạng thái đơn hàng và xử lý logic tồn kho.
 */
export const updateOrderStatus = async (orderId: number, newStatus: string, changedBy: number, client: PoolClient) => {
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) throw new Error('Không tìm thấy đơn hàng.');
    const currentOrder = orderResult.rows[0];

    const validTransitions: { [key: string]: string[] } = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['completed'],
    };
    if (!validTransitions[currentOrder.order_status]?.includes(newStatus)) {
        throw new Error(`Không thể chuyển trạng thái từ '${currentOrder.order_status}' sang '${newStatus}'.`);
    }

    if (currentOrder.order_status === 'pending' && newStatus === 'confirmed') {
        const items = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
        for (const item of items.rows) {
            const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
            if(stockCheck.rows[0]?.quantity < item.quantity) throw new Error('Hết hàng trong lúc xác nhận đơn.');
            await client.query('UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2', [item.quantity, item.variant_id]);
        }
    }
    
    if (['confirmed', 'processing'].includes(currentOrder.order_status) && newStatus === 'cancelled') {
        const items = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
        for (const item of items.rows) {
            await client.query('UPDATE branch_inventories SET quantity = quantity + $1 WHERE branch_id = 0 AND variant_id = $2', [item.quantity, item.variant_id]);
        }
    }

    await client.query('UPDATE orders SET order_status = $1 WHERE id = $2', [newStatus, orderId]);
    await client.query('INSERT INTO order_status_histories (order_id, from_status, to_status, changed_by) VALUES ($1, $2, $3, $4)', [orderId, currentOrder.order_status, newStatus, changedBy]);

    const updatedOrder = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return updatedOrder.rows[0];
};

export const findOrdersByCustomerId = async (customerId: number) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY order_date DESC', [customerId]);
    return result.rows;
};

export const findOrderDetailsById = async (orderId: number) => {
    const orderPromise = pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const itemsPromise = pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    const historyPromise = pool.query('SELECT * FROM order_status_histories WHERE order_id = $1 ORDER BY created_at ASC', [orderId]);

    const [orderResult, itemsResult, historyResult] = await Promise.all([orderPromise, itemsPromise, historyPromise]);
    if(orderResult.rows.length === 0) return null;

    return {
        ...orderResult.rows[0],
        items: itemsResult.rows,
        history: historyResult.rows
    };
};
import { PoolClient } from 'pg';
import { Order } from '../../types/orders/order.type'; // Adjust path if needed
import * as CustomerAddressModel from './../locations/customer_address.model'; // Adjust path if needed
import pool from '../../../config/db'; // Adjust path if needed

// Interface for place order input data
interface PlaceOrderData {
    addressId: number;
    shippingOption: { fee: number; service_id: number; service_type_id: number };
    paymentMethod: string;
    notes?: string;
}

/**
 * Creates a new order, saving both account customer and recipient info. Clears cart if COD.
 */
export const placeOrder = async (customerId: number, data: PlaceOrderData, client: PoolClient) => {
    const { addressId, shippingOption, paymentMethod, notes } = data;

    // --- GET ACCOUNT CUSTOMER INFO ---
    const customerResult = await client.query('SELECT name, phone FROM customers WHERE id = $1', [customerId]);
    if (customerResult.rows.length === 0) {
        throw new Error(`Không tìm thấy thông tin khách hàng với ID: ${customerId}`);
    }
    const accountCustomer = customerResult.rows[0];

    // --- GET CART ITEMS ---
    const cartResult = await client.query(
        'SELECT variant_id, quantity FROM carts WHERE customer_id = $1 FOR UPDATE',
        [customerId]
    );
    const cartItems = cartResult.rows;
    if (!cartItems || cartItems.length === 0) {
        throw new Error('Giỏ hàng trống. Không thể đặt hàng.');
    }

    const variantIds = cartItems.map(item => item.variant_id);

    // --- GET VARIANT DETAILS ---
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

    // --- CHECK STOCK & CALCULATE ---
    for (const item of cartItems) {
        const variant = variantMap.get(item.variant_id);
        const stockResult = await client.query(
            'SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE',
            [item.variant_id]
        );
        const stockQuantity = stockResult.rows[0]?.quantity || 0;

        if (!variant) throw new Error(`Sản phẩm không hợp lệ trong giỏ hàng (variant_id: ${item.variant_id}).`);
        if (stockQuantity < item.quantity) throw new Error(`Sản phẩm '${variant.full_name}' không đủ tồn kho (cần ${item.quantity}, còn ${stockQuantity}).`);

        subtotal += Number(variant.price) * item.quantity;
        totalWeight += (Number(variant.weight) || 100) * item.quantity;
        orderItemsInfo.push({ ...variant, quantity: item.quantity });
    }
    const totalAmount = subtotal + shippingOption.fee;

    const initialStatus: Order['order_status'] = 'pending';
    const initialPaymentStatus: Order['payment_status'] = 'pending';

    // --- GET SHIPPING (RECIPIENT) ADDRESS INFO ---
    const shippingAddress = await CustomerAddressModel.findAddressDetailsById(addressId, client);
    if (!shippingAddress || shippingAddress.customer_id !== customerId) {
        throw new Error('Địa chỉ giao hàng không hợp lệ hoặc không thuộc về bạn.');
    }
    const fullAddressString = `${shippingAddress.address}, ${shippingAddress.ward_name}, ${shippingAddress.district_name}, ${shippingAddress.province_name}`;
    const orderNumber = `FA-${Date.now()}-${customerId}`; // This is your main order identifier

    // --- CREATE ORDER RECORD ---
    const orderResult = await client.query(
        `INSERT INTO orders (
            customer_id, order_number,           -- Account owner ID and Order identifier
            recipient_name, recipient_phone,     -- Recipient info [RENAMED]
            account_customer_name, account_customer_phone, -- Account owner info [NEW]
            shipping_address, subtotal, shipping_fee, total_amount,
            payment_method, order_status, payment_status, notes,
            shipping_province, shipping_district, shipping_ward
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`, // Returning * will fetch all columns including the renamed/new ones
        [
            customerId,                   // $1: customer_id (account owner)
            orderNumber,                  // $2: order_number
            shippingAddress.name,         // $3: recipient_name [RENAMED]
            shippingAddress.phone,        // $4: recipient_phone [RENAMED]
            accountCustomer.name,         // $5: account_customer_name [NEW]
            accountCustomer.phone,        // $6: account_customer_phone [NEW]
            fullAddressString,            // $7: shipping_address
            subtotal,                     // $8
            shippingOption.fee,           // $9
            totalAmount,                  // $10
            paymentMethod,                // $11
            initialStatus,                // $12
            initialPaymentStatus,         // $13
            notes,                        // $14
            shippingAddress.province_name,// $15
            shippingAddress.district_name,// $16
            shippingAddress.ward_name     // $17
        ]
    );
    const newOrder: Order = orderResult.rows[0];

    // --- CREATE ORDER ITEMS ---
    const itemInsertPromises = orderItemsInfo.map(item =>
        client.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_sku, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newOrder.id, item.product_id, item.variant_id, item.full_name, item.sku, item.quantity, item.price]
        )
    );
    await Promise.all(itemInsertPromises);

    // --- CREATE INITIAL STATUS HISTORY ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, to_status, notes, changed_by) VALUES ($1, $2, $3, $4)',
        [newOrder.id, initialStatus, 'Đơn hàng được tạo thành công.', null]
    );

    // --- CLEAR CART IF COD ---
    if (paymentMethod.toLowerCase() === 'cod') {
        await client.query('DELETE FROM carts WHERE customer_id = $1', [customerId]);
        console.log(`Cleared cart for customer ${customerId} after placing COD order ${newOrder.id}`);
    }

    // --- RETURN RESULTS ---
    return { newOrder, orderItems: orderItemsInfo, shippingAddress, totalWeight, totalAmount };
};

/**
 * Confirms successful online payment, updates status, deducts stock.
 */
export const confirmOnlinePaymentAndUpdateStock = async (orderId: number, transactionId: string, client: PoolClient): Promise<Order> => {
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
        throw new Error(`Không tìm thấy đơn hàng với ID: ${orderId} để xác nhận thanh toán.`);
    }
    const order: Order = orderResult.rows[0];

    if (order.order_status !== 'pending' || order.payment_status !== 'pending') {
        console.warn(`Đơn hàng ${orderId} đã được xử lý thanh toán trước đó.`);
        return order;
    }

    // --- DEDUCT STOCK ---
    const itemsResult = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    const stockUpdatePromises = itemsResult.rows.map(async item => {
        const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
        const currentStock = stockCheck.rows[0]?.quantity || 0;
        if (currentStock < item.quantity) {
             throw new Error(`Hết hàng cho sản phẩm (variant_id: ${item.variant_id}) trong lúc xác nhận thanh toán.`);
        }
        return client.query('UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2', [item.quantity, item.variant_id]);
    });
    await Promise.all(stockUpdatePromises);

    // --- UPDATE ORDER STATUS & PAYMENT STATUS ---
    const updatedOrderResult = await client.query(
        `UPDATE orders
         SET order_status = $1, payment_status = $2,
             confirmed_at = CASE WHEN confirmed_at IS NULL THEN NOW() ELSE confirmed_at END,
             updated_at = NOW()
         WHERE id = $3 RETURNING *`, // RETURNING * will get the updated row with new/renamed columns
        ['confirmed', 'paid', orderId]
    );

    // --- UPDATE PAYMENT RECORD ---
    await client.query(
        'UPDATE payments SET status = $1, transaction_id = $2, payment_date = NOW(), updated_at = NOW() WHERE order_id = $3 AND status = $4',
        ['completed', transactionId, orderId, 'pending']
    );

    // --- CREATE STATUS HISTORY ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, from_status, to_status, notes, changed_by) VALUES ($1, $2, $3, $4, $5)',
        [orderId, 'pending', 'confirmed', `Thanh toán ${order.payment_method} thành công (Mã GD cổng TT: ${transactionId})`, null]
    );

    // --- CLEAR CART ---
    await client.query('DELETE FROM carts WHERE customer_id = $1', [order.customer_id]);
    console.log(`Cleared cart for customer ${order.customer_id} after successful online payment for order ${orderId}`);

    return updatedOrderResult.rows[0];
};


/**
 * @description Admin updates order status, handles stock, history, and updates relevant order timestamp/user fields.
 */
export const updateOrderStatusByAdmin = async (
    orderId: number,
    newStatus: Order['order_status'],
    changedBy: number,
    client: PoolClient,
    reason?: string
): Promise<Order> => {
    // Get and lock the current order (fetches new/renamed columns automatically with *)
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
        throw new Error(`Không tìm thấy đơn hàng với ID: ${orderId}.`);
    }
    const currentOrder: Order = orderResult.rows[0];

    // --- VALIDATE STATUS TRANSITION ---
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

    // --- HANDLE STOCK LOGIC ---
    if ((currentOrder.payment_method || '').toLowerCase() === 'cod' && currentOrder.order_status === 'pending' && newStatus === 'confirmed') {
        const stockUpdatePromises = orderItems.map(async item => { /* ... stock deduction logic ... */
             const stockCheck = await client.query('SELECT quantity FROM branch_inventories WHERE branch_id = 0 AND variant_id = $1 FOR UPDATE', [item.variant_id]);
             const currentStock = stockCheck.rows[0]?.quantity || 0;
             if (currentStock < item.quantity) { throw new Error(`Hết hàng: variant_id ${item.variant_id}.`); }
             return client.query('UPDATE branch_inventories SET quantity = quantity - $1 WHERE branch_id = 0 AND variant_id = $2', [item.quantity, item.variant_id]);
        });
        await Promise.all(stockUpdatePromises);
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['paid', orderId]);
    }
    else if (['confirmed', 'processing'].includes(currentOrder.order_status) && newStatus === 'cancelled') {
        const stockRevertPromises = orderItems.map(item => /* ... stock revert logic ... */
             client.query('UPDATE branch_inventories SET quantity = quantity + $1 WHERE branch_id = 0 AND variant_id = $2', [item.quantity, item.variant_id])
        );
        await Promise.all(stockRevertPromises);
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['refunded', orderId]);
        await client.query(`UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE order_id = $1 AND status = 'completed'`, [orderId]);
    }

    // --- PREPARE ORDER UPDATE CLAUSES ---
    let setClauses: string[] = ['order_status = $1', 'updated_at = NOW()'];
    const queryParams: any[] = [newStatus];

    if (newStatus === 'confirmed' && currentOrder.order_status === 'pending') {
        setClauses.push(`confirmed_by = $${queryParams.length + 1}`); queryParams.push(changedBy);
        setClauses.push(`confirmed_at = NOW()`);
    } else if (newStatus === 'shipped') {
        setClauses.push(`shipped_at = NOW()`);
    } else if (newStatus === 'completed') {
        setClauses.push(`delivered_at = NOW()`);
         if ((currentOrder.payment_method || '').toLowerCase() === 'cod') {
             setClauses.push(`payment_status = 'paid'`);
              await client.query(`UPDATE payments SET status = 'completed', payment_date = NOW(), updated_at = NOW() WHERE order_id = $1 AND payment_method = 'cod' AND status = 'pending'`, [orderId]);
         }
    } else if (newStatus === 'cancelled') {
        setClauses.push(`cancelled_at = NOW()`);
        if (reason) { setClauses.push(`cancel_reason = $${queryParams.length + 1}`); queryParams.push(reason); }
    }

    // --- UPDATE ORDER RECORD ---
    const updateQuery = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${queryParams.length + 1} RETURNING *`; // RETURNING * gets updated data
    queryParams.push(orderId);
    const updatedOrderResult = await client.query(updateQuery, queryParams);

    // --- CREATE STATUS HISTORY ---
    await client.query(
        'INSERT INTO order_status_histories (order_id, from_status, to_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
        [orderId, currentOrder.order_status, newStatus, changedBy, `Admin cập nhật trạng thái ${reason ? `- Lý do: ${reason}` : ''}`]
    );

    return updatedOrderResult.rows[0]; // Return the fully updated order row
};


// ===================================
// == READ FUNCTIONS
// ===================================

/**
 * Finds orders for a specific customer.
 */
export const findOrdersByCustomerId = async (customerId: number): Promise<Order[]> => {
    // Select the renamed and new columns
    const result = await pool.query(
        `SELECT
            o.id, o.order_number, o.order_date, o.order_status, o.total_amount,
            o.payment_method, o.payment_status,
            o.recipient_name,           -- Use renamed column
            o.account_customer_name,    -- Use new column
            (SELECT COALESCE(json_agg(json_build_object(
                'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price,
                'image', COALESCE(pv.image, p.images->>'thumbnail') )), '[]'::json)
             FROM order_items oi
             LEFT JOIN product_variants pv ON oi.variant_id = pv.id
             LEFT JOIN products p ON pv.product_id = p.id
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
 * Finds detailed information for a single order.
 */
export const findOrderDetailsById = async (orderId: number): Promise<(Order & { items: any[], history: any[], shipment: any, payments: any[] }) | null> => {
    // 1. Fetch main order data
    const orderPromise = pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    // 2. Fetch order items and JOIN with product_variants and products for current variant details
    const itemsPromise = pool.query(
        `SELECT
            oi.id, oi.order_id, oi.product_id, oi.variant_id,
            oi.product_name, oi.product_sku, oi.quantity, oi.unit_price, -- Data from order_items
            COALESCE(pv.image, p.images->>'thumbnail') as image, -- Resolved image
            -- Additional current variant data <<--- THÊM CÁC TRƯỜNG VARIANT
            pv.sku as variant_sku,
            pv.name as variant_name,
            pv.weight,
            pv.length,
            pv.width,
            pv.height
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.variant_id = pv.id
         LEFT JOIN products p ON oi.product_id = p.id -- Join product mainly for fallback image
         WHERE oi.order_id = $1 ORDER BY oi.id ASC`,
        [orderId]
    );

    // 3. Fetch order status history with user names
    const historyPromise = pool.query(
        `SELECT h.*, u.name as changed_by_name
         FROM order_status_histories h
         LEFT JOIN users u ON h.changed_by = u.id
         WHERE h.order_id = $1 ORDER BY h.created_at ASC`,
        [orderId]
    );

    // 4. Fetch shipment information
    const shipmentPromise = pool.query('SELECT * FROM shipments WHERE order_id = $1', [orderId]);

    // 5. Fetch payment information
    const paymentPromise = pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);

    // Execute all queries in parallel
    const [
        orderResult,
        itemsResult,
        historyResult,
        shipmentResult,
        paymentResult
    ] = await Promise.all([
        orderPromise,
        itemsPromise,
        historyPromise,
        shipmentPromise,
        paymentPromise
    ]);

    // If order not found, return null
    if (orderResult.rows.length === 0) {
        return null;
    }

    // Process items: parse numbers and include new variant fields
    const items = itemsResult.rows.map(item => ({
        // Keep original order_item fields
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: parseInt(item.quantity, 10),
        unit_price: parseFloat(item.unit_price),
        image: item.image,
        // Add the new variant fields <<--- THÊM VÀO KẾT QUẢ TRẢ VỀ
        variant_sku: item.variant_sku,
        variant_name: item.variant_name,
        weight: item.weight ? parseFloat(item.weight) : null,
        length: item.length ? parseFloat(item.length) : null,
        width: item.width ? parseFloat(item.width) : null,
        height: item.height ? parseFloat(item.height) : null,
    }));

     // Process payments: parse amount
     const payments = paymentResult.rows.map(p => ({
        ...p,
        amount: parseFloat(p.amount)
    }));

    // Combine results
    return {
        ...orderResult.rows[0], // Spread the main order data
        items: items, // Include the enriched items array
        history: historyResult.rows,
        shipment: shipmentResult.rows[0] || null,
        payments: payments
    };
};
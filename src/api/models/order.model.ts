import { PoolClient } from 'pg';
import { Order } from '../types/order.type';
import { CustomerAddress } from '../types/customer_address.type';
import * as CustomerAddressModel from './customer_address.model';

interface CartItemInfo {
    variant_id: number;
    quantity: number;
    name: string;
    price: number;
    weight: number;
    stock_quantity: number;
    product_id: number;
    sku: string | null;
    length: number | null;
    width: number | null;
    height: number | null;
}

interface PlaceOrderData {
    addressId: number;
    shippingOption: { service_id: number; service_type_id: number; fee: number; service_name: string; };
    paymentMethod: string;
    notes?: string;
    items: { variant_id: number, quantity: number }[];
}

/**
 * [VIẾT LẠI] Tạo đơn hàng, chi tiết đơn hàng, cập nhật kho, và xóa sản phẩm khỏi giỏ.
 * Phải được gọi bên trong một transaction.
 */
export const placeOrder = async (customerId: number, data: PlaceOrderData, client: PoolClient): Promise<{ newOrder: Order, orderItems: CartItemInfo[], shippingAddress: any, totalWeight: number, totalValue: number }> => {
    const { addressId, shippingOption, paymentMethod, notes, items } = data;

    if (!items || items.length === 0) {
        throw new Error('Không có sản phẩm nào để đặt hàng.');
    }

    // 1. Lấy thông tin chi tiết của các variant được chọn
    const variantIds = items.map(item => item.variant_id);
    const variantResult = await client.query(
        `SELECT id as variant_id, name, price, weight, stock_quantity, product_id, sku, length, width, height FROM product_variants WHERE id = ANY($1::int[])`,
        [variantIds]
    );
    const variantMap = new Map(variantResult.rows.map(v => [v.variant_id, v]));

    // 2. Kiểm tra tồn kho và tính toán
    const orderItemsInfo: CartItemInfo[] = [];
    let subtotal = 0;
    let totalWeight = 0;

    for (const item of items) {
        const variant = variantMap.get(item.variant_id);
        if (!variant) throw new Error(`Sản phẩm với variant_id ${item.variant_id} không tồn tại.`);
        if (variant.stock_quantity < item.quantity) throw new Error(`Sản phẩm '${variant.name}' không đủ số lượng tồn kho.`);
        
        subtotal += variant.price * item.quantity;
        totalWeight += (variant.weight || 0) * item.quantity;
        orderItemsInfo.push({ ...variant, quantity: item.quantity });
    }
    const totalAmount = subtotal + shippingOption.fee;

    // 3. Lấy thông tin chi tiết địa chỉ giao hàng (sử dụng hàm mới)
    const shippingAddress = await CustomerAddressModel.findAddressDetailsById(addressId, client);
    if (!shippingAddress || shippingAddress.customer_id !== customerId) {
        throw new Error('Địa chỉ giao hàng không hợp lệ.');
    }

    // 4. Tạo bản ghi `orders`
    const fullAddressString = `${shippingAddress.address}, ${shippingAddress.ward_name}, ${shippingAddress.district_name}, ${shippingAddress.province_name}`;
    const orderNumber = `FA-${Date.now()}`;
    const orderResult = await client.query(
        `INSERT INTO orders (customer_id, order_number, customer_name, customer_phone, shipping_address, subtotal, shipping_fee, total_amount, payment_method, order_status, notes, shipping_province, shipping_district, shipping_ward)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13) RETURNING *`,
        [
            customerId, orderNumber, shippingAddress.name, shippingAddress.phone, fullAddressString,
            subtotal, shippingOption.fee, totalAmount, paymentMethod, notes,
            shippingAddress.province_name, shippingAddress.district_name, shippingAddress.ward_name
        ]
    );
    const newOrder = orderResult.rows[0];

    // 5. Tạo các bản ghi `order_items` và cập nhật tồn kho
    for (const item of orderItemsInfo) {
        await client.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_sku, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newOrder.id, item.product_id, item.variant_id, item.name, item.sku, item.quantity, item.price]
        );
        await client.query('UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, item.variant_id]);
    }

    // 6. Xóa các sản phẩm đã mua khỏi giỏ hàng
    await client.query('DELETE FROM carts WHERE customer_id = $1 AND variant_id = ANY($2::int[])', [customerId, variantIds]);
    
    return { newOrder, orderItems: orderItemsInfo, shippingAddress, totalWeight, totalValue: totalAmount };
};
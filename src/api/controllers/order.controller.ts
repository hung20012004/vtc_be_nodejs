import { Request, Response, NextFunction } from 'express';
import pool from '../../config/db';
import * as OrderModel from '../models/order.model';
import * as CustomerModel from '../models/customer.model';
import { User } from '../types/user.type';
import { ShippingService } from '../services/shipping.service';

const shippingService = new ShippingService();

// --- THÔNG TIN KHO HÀNG CỦA BẠN ---
// Trong thực tế, bạn nên lưu thông tin này trong database và truy vấn ra.
const SHOP_INFO = {
    shop_id: 197598, // Shop ID của bạn từ GHN
    from_name: "FruitApp - Nông sản sạch",
    from_phone: "0335556124",
    from_address: "Số 1 Đại Cồ Việt, Bách Khoa",
    from_ward_name: "Bách Khoa",
    from_district_name: "Hai Bà Trưng",
    from_province_name: "Hà Nội"
};

export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });
        }

        await client.query('BEGIN');

        const { newOrder, orderItems, shippingAddress, totalWeight, totalValue } = await OrderModel.placeOrder(customer.id, req.body, client);
        
        // =========================================================================
        // === PAYLOAD CHÍNH XÁC THEO TÀI LIỆU API GHN ===
        // =========================================================================
        const ghnOrderPayload = {
            // Thông tin người nhận
            to_name: shippingAddress.name,
            to_phone: shippingAddress.phone,
            to_address: shippingAddress.address,
            to_ward_name: shippingAddress.ward_name,
            to_district_name: shippingAddress.district_name,
            to_province_name: shippingAddress.province_name,

            // Thông tin người gửi (Lấy từ cấu hình shop)
            ...SHOP_INFO,
            
            // Thông tin gói hàng
            weight: totalWeight,
            length: 30, // Kích thước đóng gói mặc định
            width: 20,
            height: 15,
            
            // Thông tin dịch vụ và thanh toán
            service_id: req.body.shippingOption.service_id,
            service_type_id: req.body.shippingOption.service_type_id,
            payment_type_id: 2,
            cod_amount: newOrder.payment_method === 'cod' ? newOrder.total_amount : 0,
            required_note: "CHOXEMHANGKHONGTHU",
            note: newOrder.notes || "",
            
            // Mã đơn hàng của bạn để đối soát
            client_order_code: newOrder.order_number,
            
            content: `Thanh toán đơn hàng ${newOrder.order_number} cho FruitApp.`,
            
            // Chi tiết sản phẩm
            items: orderItems.map((item: any) => ({
                name: item.name,
                code: item.sku || item.variant_id.toString(),
                quantity: item.quantity,
                price: item.price,
                length: Math.round(item.length || 10),
                width: Math.round(item.width || 10),
                height: Math.round(item.height || 5),
                weight: Math.round(item.weight || 100),
            }))
        };
        // =========================================================================
        
        const ghnShipment = await shippingService.createOrder('ghn', ghnOrderPayload);
        
        await client.query(
            'INSERT INTO shipments (order_id, carrier_id, tracking_number, shipping_cost, status) VALUES ($1, $2, $3, $4, 1)',
            [newOrder.id, 1, ghnShipment.order_code, ghnShipment.total_fee]
        );
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Đặt hàng và tạo đơn vận chuyển thành công!',
            order: newOrder,
            shipment: ghnShipment
        });

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};
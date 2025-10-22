import { Request, Response, NextFunction } from 'express';
import pool from '../../../config/db';
import { VNPayService } from '../../services/vnpay.service'; // Đảm bảo đường dẫn đúng
import * as OrderModel from '../../models/orders/order.model'; // Đảm bảo đường dẫn đúng
import { Order } from '../../types/orders/order.type'; 
import { env } from '../../../config/env'; // Import cấu hình env

const vnpayService = new VNPayService();

/**
 * @description Xử lý khi VNPay redirect người dùng về trang Return URL.
 * Chỉ dùng để hiển thị thông báo tạm thời, không cập nhật DB.
 */
export const handleVnpayReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const vnpParams = req.query as Record<string, string>; // Lấy tham số từ URL query
        const secureHash = vnpParams['vnp_SecureHash'];

        // Xác thực chữ ký trước khi xử lý
        const isValidSignature = vnpayService.verifySignature(vnpParams);

        const orderId = vnpParams['vnp_TxnRef']; // Mã đơn hàng bạn gửi đi
        const responseCode = vnpParams['vnp_ResponseCode'];

        // Tạo URL redirect về frontend
        const redirectUrl = new URL(env.VNP_RETURN_URL); // Lấy URL gốc từ env
        redirectUrl.searchParams.set('orderId', orderId);
        redirectUrl.searchParams.set('code', responseCode);

        if (isValidSignature) {
            if (responseCode === '00') {
                redirectUrl.searchParams.set('success', 'true');
                redirectUrl.searchParams.set('message', 'Giao dịch thành công. Đang chờ xác nhận cuối cùng.');
            } else {
                redirectUrl.searchParams.set('success', 'false');
                redirectUrl.searchParams.set('message', 'Giao dịch thất bại hoặc bị hủy.');
            }
        } else {
            redirectUrl.searchParams.set('success', 'false');
            redirectUrl.searchParams.set('message', 'Chữ ký không hợp lệ.');
        }

        // Chuyển hướng người dùng về frontend với các tham số kết quả
        res.redirect(redirectUrl.toString());

    } catch (error) {
        console.error("VNPay Return Error:", error);
        // Chuyển hướng về trang lỗi chung trên frontend nếu cần
        const errorRedirectUrl = new URL(env.VNP_RETURN_URL);
        errorRedirectUrl.searchParams.set('success', 'false');
        errorRedirectUrl.searchParams.set('message', 'Đã xảy ra lỗi khi xử lý kết quả thanh toán.');
        res.redirect(errorRedirectUrl.toString());
        next(error); // Log lỗi ở server
    }
};

/**
 * @description Xử lý request IPN từ server VNPay. Đây là nơi xác nhận thanh toán cuối cùng và cập nhật database.
 */
export const handleVnpayIPN = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    let rspCode = '99'; // Mã phản hồi mặc định cho VNPay là lỗi không xác định
    let message = 'Unknown error';

    try {
        const vnpParams = req.query as Record<string, string>; // Lấy tham số IPN từ query params
        const secureHash = vnpParams['vnp_SecureHash'];

        console.log('Received VNPay IPN:', vnpParams); // Log lại để debug

        // --- 1. Xác thực chữ ký ---
        const isValidSignature = vnpayService.verifySignature(vnpParams);
        if (!isValidSignature) {
            rspCode = '97';
            message = 'Invalid Checksum';
            console.error('VNPay IPN Error: Invalid Checksum');
            return res.status(200).json({ RspCode: rspCode, Message: message });
        }

        // --- 2. Lấy thông tin cần thiết ---
        const orderIdString = vnpParams['vnp_TxnRef'];
        const vnPayTransactionId = vnpParams['vnp_TransactionNo']; // Mã giao dịch VNPay
        const responseCode = vnpParams['vnp_ResponseCode'];
        const amount = parseInt(vnpParams['vnp_Amount'], 10) / 100; // Số tiền thực tế VNPay xử lý

        const orderId = parseInt(orderIdString, 10);
        if (isNaN(orderId)) {
             rspCode = '01'; // Mã lỗi: Order not found
             message = 'Invalid order reference (vnp_TxnRef)';
             console.error('VNPay IPN Error: Invalid orderId');
             return res.status(200).json({ RspCode: rspCode, Message: message });
        }


        await client.query('BEGIN'); // Bắt đầu Transaction Database

        // --- 3. Kiểm tra đơn hàng trong DB ---
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            rspCode = '01';
            message = 'Order not found';
            console.error(`VNPay IPN Error: Order ${orderId} not found`);
            return res.status(200).json({ RspCode: rspCode, Message: message });
        }
        const order: Order = orderResult.rows[0];

        // --- 4. Kiểm tra số tiền ---
        // So sánh số tiền làm tròn hoặc có sai số nhỏ nếu cần
        if (Math.round(order.total_amount) != Math.round(amount)) {
             await client.query('ROLLBACK');
             rspCode = '04';
             message = 'Invalid amount';
             console.error(`VNPay IPN Error: Amount mismatch for order ${orderId}. Expected: ${order.total_amount}, Received: ${amount}`);
             return res.status(200).json({ RspCode: rspCode, Message: message });
        }

        // --- 5. Kiểm tra trạng thái thanh toán hiện tại ---
         const paymentResult = await client.query('SELECT status FROM payments WHERE order_id = $1 AND payment_method = $2 FOR UPDATE', [orderId, 'vnpay']);
         // Đơn hàng phải có record payment tương ứng
         if (paymentResult.rows.length === 0) {
             await client.query('ROLLBACK');
             rspCode = '02'; // Giả sử mã 02 là lỗi logic nội bộ
             message = 'Payment record not found';
             console.error(`VNPay IPN Error: Payment record not found for order ${orderId}`);
             return res.status(200).json({ RspCode: rspCode, Message: message });
         }
         // Nếu payment đã hoàn thành trước đó -> Báo thành công cho VNPay biết là đã xử lý rồi
         if (paymentResult.rows[0].status === 'completed') {
             await client.query('ROLLBACK'); // Không cần commit lại
             rspCode = '00'; // Báo thành công vì đã xử lý rồi
             message = 'Order already confirmed';
             console.log(`VNPay IPN Info: Order ${orderId} already confirmed.`);
             return res.status(200).json({ RspCode: rspCode, Message: message });
         }
         // Nếu order không còn pending (vd: đã bị admin hủy) -> Báo lỗi
         if (order.order_status !== 'pending' || order.payment_status !== 'pending') {
            await client.query('ROLLBACK');
            rspCode = '02'; // Order state invalid
            message = 'Order status is not pending for payment confirmation';
            console.warn(`VNPay IPN Warning: Order ${orderId} status is not pending (${order.order_status}, ${order.payment_status}). Cannot confirm payment.`);
            return res.status(200).json({ RspCode: rspCode, Message: message });
         }


        // --- 6. Xử lý kết quả thanh toán ---
        if (responseCode === '00') { // Thanh toán thành công
            try {
                // Gọi hàm model để cập nhật order, payment, trừ kho, ghi history, xóa cart
                await OrderModel.confirmOnlinePaymentAndUpdateStock(orderId, vnPayTransactionId, client);
                await client.query('COMMIT'); // Commit transaction DB
                rspCode = '00';
                message = 'Confirm Success';
                console.log(`VNPay IPN Success: Confirmed payment for order ${orderId}`);
            } catch (stockError) {
                // Lỗi xảy ra trong quá trình trừ kho (vd: hết hàng đột ngột)
                await client.query('ROLLBACK');
                console.error(`VNPay IPN Error: Failed to update stock for order ${orderId}`, stockError);
                rspCode = '99'; // Lỗi hệ thống merchant
                message = 'Internal error during stock update';
                 // Cân nhắc: Gọi API hoàn tiền VNPay nếu trừ kho thất bại
            }
        } else { // Thanh toán thất bại
            // Cập nhật payment status thành 'failed'
            await client.query('UPDATE payments SET status = $1, notes = $2, updated_at = NOW() WHERE order_id = $3 AND status = $4',
                ['failed', `VNPay failed, code: ${responseCode}`, orderId, 'pending']);
            // Có thể cập nhật cả order status thành 'cancelled' nếu muốn
            // await OrderModel.updateOrderStatusByAdmin(orderId, 'cancelled', null, client); // Hoặc tạo hàm riêng
            await client.query('COMMIT');
            rspCode = '00'; // Vẫn phản hồi 00 cho VNPay để họ không gửi lại IPN thất bại
            message = 'Payment failed notification received'; // Ghi nhận thông báo thất bại
            console.log(`VNPay IPN Info: Payment failed for order ${orderId}, Code: ${responseCode}`);
        }

        // --- 7. Phản hồi cho VNPay Server ---
        return res.status(200).json({ RspCode: rspCode, Message: message });

    } catch (error) {
        if (client) await client.query('ROLLBACK'); // Đảm bảo rollback nếu có lỗi bất ngờ
        console.error("VNPay IPN Unhandled Error:", error);
        // Luôn phản hồi mã lỗi chung cho VNPay trong trường hợp lỗi không mong muốn
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
        next(error); // Log lỗi ở server để debug
    } finally {
        if (client) client.release(); // Luôn trả kết nối
    }
};
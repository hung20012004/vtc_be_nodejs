// src/api/controllers/payment.controller.ts

import { Request, Response, NextFunction } from 'express';
import pool from '../../../config/db'; // Adjust path if needed
import { VNPayService } from '../../services/vnpay.service'; // Adjust path if needed
import { MomoService } from '../../services/momo.service'; // Adjust path if needed
import * as OrderModel from '../../models/orders/order.model'; // Adjust path if needed
import { Order } from '../../types/orders/order.type'; // Adjust path if needed
import { env } from '../../../config/env'; // Adjust path if needed

const vnpayService = new VNPayService();
const momoService = new MomoService(); // Initialize MomoService

// ===========================================
// == VNPay Callbacks (Keep Existing Code)
// ===========================================
export const handleVnpayReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const vnpParams = req.query as Record<string, string>;
        const isValidSignature = vnpayService.verifySignature(vnpParams);
        const orderId = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const redirectUrl = new URL(env.VNP_RETURN_URL);
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
        res.redirect(redirectUrl.toString());
    } catch (error) {
        console.error("VNPay Return Error:", error);
        const errorRedirectUrl = new URL(env.VNP_RETURN_URL);
        errorRedirectUrl.searchParams.set('success', 'false');
        errorRedirectUrl.searchParams.set('message', 'Đã xảy ra lỗi khi xử lý kết quả thanh toán.');
        res.redirect(errorRedirectUrl.toString());
        next(error);
    }
};

export const handleVnpayIPN = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    let rspCode = '99';
    let message = 'Unknown error';

    try {
        const vnpParams = req.query as Record<string, string>;
        console.log('Received VNPay IPN:', vnpParams);
        const isValidSignature = vnpayService.verifySignature(vnpParams);
        if (!isValidSignature) {
            rspCode = '97'; message = 'Invalid Checksum';
            console.error('VNPay IPN Error: Invalid Checksum');
            return res.status(200).json({ RspCode: rspCode, Message: message });
        }

        const orderIdString = vnpParams['vnp_TxnRef'];
        const vnPayTransactionId = vnpParams['vnp_TransactionNo'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const amount = parseInt(vnpParams['vnp_Amount'], 10) / 100;
        const orderId = parseInt(orderIdString, 10);

        if (isNaN(orderId)) {
             rspCode = '01'; message = 'Invalid order reference (vnp_TxnRef)';
             console.error('VNPay IPN Error: Invalid orderId');
             return res.status(200).json({ RspCode: rspCode, Message: message });
        }

        await client.query('BEGIN');
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK'); rspCode = '01'; message = 'Order not found';
            console.error(`VNPay IPN Error: Order ${orderId} not found`);
            return res.status(200).json({ RspCode: rspCode, Message: message });
        }
        const order: Order = orderResult.rows[0];

        if (Math.round(order.total_amount) != Math.round(amount)) {
             await client.query('ROLLBACK'); rspCode = '04'; message = 'Invalid amount';
             console.error(`VNPay IPN Error: Amount mismatch for order ${orderId}.`);
             return res.status(200).json({ RspCode: rspCode, Message: message });
        }

        const paymentResult = await client.query('SELECT status FROM payments WHERE order_id = $1 AND payment_method = $2 FOR UPDATE', [orderId, 'vnpay']);
        if (paymentResult.rows.length === 0) {
             await client.query('ROLLBACK'); rspCode = '02'; message = 'Payment record not found';
             console.error(`VNPay IPN Error: Payment record not found for order ${orderId}`);
             return res.status(200).json({ RspCode: rspCode, Message: message });
         }
         if (paymentResult.rows[0].status === 'completed') {
             await client.query('ROLLBACK'); rspCode = '02'; message = 'Order already confirmed'; // Use 02 for already processed
             console.log(`VNPay IPN Info: Order ${orderId} already confirmed.`);
             return res.status(200).json({ RspCode: rspCode, Message: message });
         }
        if (order.order_status !== 'pending' || order.payment_status !== 'pending') {
            await client.query('ROLLBACK'); rspCode = '02'; message = 'Order status is not pending';
            console.warn(`VNPay IPN Warning: Order ${orderId} status not pending.`);
            return res.status(200).json({ RspCode: rspCode, Message: message });
         }

        if (responseCode === '00') {
            try {
                await OrderModel.confirmOnlinePaymentAndUpdateStock(orderId, vnPayTransactionId, client);
                await client.query('COMMIT');
                rspCode = '00'; message = 'Confirm Success';
                console.log(`VNPay IPN Success: Confirmed payment for order ${orderId}`);
            } catch (stockError) {
                await client.query('ROLLBACK');
                console.error(`VNPay IPN Error: Failed to update stock for order ${orderId}`, stockError);
                rspCode = '99'; message = 'Internal error during stock update';
            }
        } else {
            await client.query('UPDATE payments SET status = $1, notes = $2, updated_at = NOW() WHERE order_id = $3 AND status = $4',
                ['failed', `VNPay failed, code: ${responseCode}`, orderId, 'pending']);
            await client.query('COMMIT');
            rspCode = '00'; // Still respond 00 for failure notification
            message = 'Payment failed notification received';
            console.log(`VNPay IPN Info: Payment failed for order ${orderId}, Code: ${responseCode}`);
        }
        return res.status(200).json({ RspCode: rspCode, Message: message });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("VNPay IPN Unhandled Error:", error);
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
        next(error);
    } finally {
        if (client) client.release();
    }
};

// ===========================================
// == MoMo Callbacks
// ===========================================

/**
 * @description Handles MoMo redirecting the user back to the Return URL.
 * Used only for temporary display, does not update DB.
 */
export const handleMomoReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queryParams = req.query as Record<string, string>;
        console.log("MoMo Return Params:", queryParams);

        const resultCode = queryParams['resultCode'];
        const momoOrderId = queryParams['orderId'];
        const orderId = momoOrderId ? momoOrderId.split('_')[0] : 'unknown'; // Extract original order ID

        const redirectUrl = new URL(env.MOMO_REDIRECT_URL); // Use MoMo redirect URL from env
        redirectUrl.searchParams.set('orderId', orderId);
        redirectUrl.searchParams.set('code', resultCode);
        redirectUrl.searchParams.set('message', queryParams['message'] || ''); // Add message param

        if (resultCode === '0') { // Success according to MoMo
            redirectUrl.searchParams.set('success', 'true');
        } else { // Failed or cancelled
            redirectUrl.searchParams.set('success', 'false');
        }

        res.redirect(redirectUrl.toString());

    } catch (error) {
        console.error("MoMo Return Error:", error);
        const errorRedirectUrl = new URL(env.MOMO_REDIRECT_URL);
        errorRedirectUrl.searchParams.set('success', 'false');
        errorRedirectUrl.searchParams.set('message', 'Lỗi xử lý kết quả MoMo.');
        res.redirect(errorRedirectUrl.toString());
        next(error);
    }
};

/**
 * @description Handles the IPN (POST) request from MoMo's server. This is the final payment confirmation.
 */
export const handleMomoIPN = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    // MoMo expects a quick response, typically 204 No Content for acknowledgement.

    try {
        const ipnData = req.body; // MoMo sends IPN via JSON body
        console.log('Received MoMo IPN:', ipnData);

        // --- 1. Verify IPN Signature ---
        const isValidSignature = momoService.verifyIPNSignature(ipnData);
        if (!isValidSignature) {
            console.error('MoMo IPN Error: Invalid Signature');
            // Acknowledge receipt even if signature is invalid so MoMo doesn't retry indefinitely
            return res.status(204).send();
        }

        // --- 2. Extract Necessary Information ---
        const resultCode = ipnData.resultCode;
        const momoOrderId = ipnData.orderId; // e.g., "123_timestamp"
        const orderIdString = momoOrderId ? momoOrderId.split('_')[0] : null; // Get original order ID
        const momoTransId = ipnData.momoTransId?.toString(); // MoMo's transaction ID
        const amount = parseInt(ipnData.amount, 10); // Amount processed by MoMo

        const orderId = orderIdString ? parseInt(orderIdString, 10) : NaN;
        if (isNaN(orderId)) {
             console.error('MoMo IPN Error: Invalid orderId extracted from MoMo orderId');
             return res.status(204).send(); // Acknowledge receipt
        }

        await client.query('BEGIN'); // Start Database Transaction

        // --- 3. Check Order & Payment in DB ---
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            console.error(`MoMo IPN Error: Order ${orderId} not found`);
            return res.status(204).send(); // Acknowledge receipt
        }
        const order: Order = orderResult.rows[0];

        // --- 4. Verify Amount ---
        // Use Math.round for safety due to potential floating point inaccuracies
        if (Math.round(order.total_amount) != Math.round(amount)) {
             await client.query('ROLLBACK');
             console.error(`MoMo IPN Error: Amount mismatch for order ${orderId}. Expected: ${order.total_amount}, Received: ${amount}`);
             return res.status(204).send(); // Acknowledge receipt
        }

        // --- 5. Check Current Payment Status ---
        const paymentResult = await client.query("SELECT status FROM payments WHERE order_id = $1 AND payment_method = 'momo' FOR UPDATE", [orderId]);
        if (paymentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            console.error(`MoMo IPN Error: Momo Payment record not found for order ${orderId}`);
            return res.status(204).send(); // Acknowledge receipt
        }
        // If already completed, acknowledge MoMo but do nothing further
        if (paymentResult.rows[0].status === 'completed') {
            await client.query('ROLLBACK'); // No DB changes needed
            console.log(`MoMo IPN Info: Order ${orderId} payment already confirmed.`);
            return res.status(204).send(); // Acknowledge receipt
        }
        // Check order status as well
        if (order.order_status !== 'pending' || order.payment_status !== 'pending') {
            await client.query('ROLLBACK');
            console.warn(`MoMo IPN Warning: Order ${orderId} status is not pending (${order.order_status}, ${order.payment_status}). Cannot confirm payment.`);
            return res.status(204).send(); // Acknowledge receipt
        }

        // --- 6. Process Payment Result ---
        if (resultCode === 0) { // Payment successful
            try {
                // Call the shared function to update order, payment, stock, history, cart
                await OrderModel.confirmOnlinePaymentAndUpdateStock(orderId, momoTransId, client);
                await client.query('COMMIT'); // Commit DB changes
                console.log(`MoMo IPN Success: Confirmed payment for order ${orderId}`);
            } catch (updateError) {
                // Error during stock update or other DB operations
                await client.query('ROLLBACK');
                console.error(`MoMo IPN Error: Failed to update order/stock for order ${orderId}`, updateError);
                // Consider refund logic if stock update fails critically
                // Respond 500 to potentially trigger MoMo retry? Or 204? Let's stick to 204 for now.
                return res.status(204).send();
            }
        } else { // Payment failed
            // Update payment status to 'failed'
            await client.query("UPDATE payments SET status = 'failed', notes = $1, updated_at = NOW() WHERE order_id = $2 AND status = 'pending' AND payment_method = 'momo'",
                [`MoMo failed, code: ${resultCode}, msg: ${ipnData.message || 'N/A'}`, orderId]);
            // Optional: Update order status to 'cancelled'
            // await OrderModel.updateOrderStatusByAdmin(orderId, 'cancelled', null, client); // Needs adjustment if using system user
            await client.query('COMMIT');
            console.log(`MoMo IPN Info: Payment failed for order ${orderId}, Code: ${resultCode}`);
        }

        // --- 7. Acknowledge MoMo Server ---
        return res.status(204).send(); // Send 204 No Content to indicate successful processing

    } catch (error) {
        // Handle unexpected errors
        if (client) await client.query('ROLLBACK');
        console.error("MoMo IPN Unhandled Error:", error);
        // Respond with an error status (MoMo might retry IPN)
        // A 500 error might be more appropriate here than 204 if you want MoMo to retry.
        res.status(500).json({ message: 'Internal Server Error' });
        next(error); // Log error via global error handler
    } finally {
        if (client) client.release(); // Always release the client
    }
};
// src/api/services/momo.service.ts
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { env } from '../../config/env';
import { Order } from '../types/orders/order.type'; // Đảm bảo đường dẫn đúng

interface MomoPaymentResponse {
    partnerCode: string;
    requestId: string;
    orderId: string;
    amount: number;
    responseTime: number;
    message: string;
    resultCode: number;
    payUrl: string;
    deeplink?: string;
    qrCodeUrl?: string;
}

export class MomoService {
    private partnerCode: string;
    private accessKey: string;
    private secretKey: string;
    private apiEndpoint: string;
    private redirectUrl: string;
    private ipnUrl: string;

    constructor() {
        this.partnerCode = env.MOMO_PARTNER_CODE;
        this.accessKey = env.MOMO_ACCESS_KEY;
        this.secretKey = env.MOMO_SECRET_KEY;
        this.apiEndpoint = env.MOMO_API_ENDPOINT;
        this.redirectUrl = env.MOMO_REDIRECT_URL;
        this.ipnUrl = env.MOMO_IPN_URL;
    }

    /**
     * Tạo yêu cầu thanh toán MoMo và lấy URL thanh toán.
     * @param order Đối tượng đơn hàng.
     * @param amount Số tiền thanh toán.
     * @param requestId Mã yêu cầu duy nhất cho request này.
     * @returns Promise chứa URL thanh toán hoặc ném lỗi.
     */
    async createPaymentRequest(order: Order, amount: number, requestId: string): Promise<string> {
        const orderId = order.id.toString() + '_' + new Date().getTime(); // Tạo orderId duy nhất cho MoMo
        const orderInfo = `Thanh toán đơn hàng ${order.order_number}`;
        const amountStr = amount.toString();
        const extraData = ""; // Có thể thêm thông tin mã hóa base64 nếu cần

        // Chuỗi dữ liệu để tạo chữ ký (rawSignature)
        // Thứ tự các trường RẤT QUAN TRỌNG
        const rawSignature = `accessKey=${this.accessKey}&amount=${amountStr}&extraData=${extraData}&ipnUrl=${this.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${this.redirectUrl}&requestId=${requestId}&requestType=captureWallet`;

        // Tạo chữ ký HMAC SHA256
        const signature = crypto.createHmac('sha256', this.secretKey)
                                .update(rawSignature)
                                .digest('hex');

        // Body của request gửi đến MoMo API
        const requestBody = {
            partnerCode: this.partnerCode,
            accessKey: this.accessKey, // Access key không có trong body theo doc v3? Kiểm tra lại doc nếu có lỗi.
            requestId: requestId,
            amount: amountStr,
            orderId: orderId,
            orderInfo: orderInfo,
            redirectUrl: this.redirectUrl,
            ipnUrl: this.ipnUrl,
            extraData: extraData,
            requestType: 'captureWallet', // Loại thanh toán một lần qua ví
            signature: signature,
            lang: 'vi' // Ngôn ngữ hiển thị trên cổng MoMo
        };

        try {
            console.log("Sending MoMo Request:", requestBody); // Log request để debug
            const response = await axios.post<MomoPaymentResponse>(this.apiEndpoint, requestBody, {
                headers: { 'Content-Type': 'application/json' }
            });

            console.log("Received MoMo Response:", response.data); // Log response để debug

            if (response.data.resultCode !== 0) {
                throw new Error(`MoMo API Error: ${response.data.message} (Code: ${response.data.resultCode})`);
            }
            if (!response.data.payUrl) {
                 throw new Error('MoMo API Error: Missing payUrl in response.');
            }

            return response.data.payUrl; // Trả về URL thanh toán

        } catch (error) {
            const errMessage = axios.isAxiosError(error)
                ? (error.response?.data ?? error.message ?? String(error))
                : (error instanceof Error ? error.message : String(error));
            console.error("MoMo API Request Failed:", errMessage);
            if (axios.isAxiosError(error) && error.response?.data?.message) {
                 throw new Error(`MoMo API Request Failed: ${error.response.data.message}`);
            }
            throw new Error('Không thể tạo yêu cầu thanh toán MoMo.');
        }
    }

    /**
     * Xác thực chữ ký trong request IPN từ MoMo.
     * @param requestBody Body của request IPN (đã parse thành object).
     * @returns true nếu chữ ký hợp lệ, false nếu không.
     */
    verifyIPNSignature(requestBody: any): boolean {
        const receivedSignature = requestBody.signature;
        if (!receivedSignature) return false;

        // Tạo lại rawSignature từ dữ liệu nhận được (KHÔNG bao gồm trường signature)
        // Thứ tự các trường PHẢI ĐÚNG theo tài liệu MoMo
        const rawSignature = `accessKey=${this.accessKey}&amount=${requestBody.amount}&extraData=${requestBody.extraData ?? ''}&message=${requestBody.message}&momoTransId=${requestBody.momoTransId}&orderId=${requestBody.orderId}&orderInfo=${requestBody.orderInfo}&orderType=${requestBody.orderType}&partnerCode=${this.partnerCode}&payType=${requestBody.payType}&requestId=${requestBody.requestId}&responseTime=${requestBody.responseTime}&resultCode=${requestBody.resultCode}`;

        // Tạo chữ ký HMAC SHA256 từ rawSignature và secretKey của bạn
        const calculatedSignature = crypto.createHmac('sha256', this.secretKey)
                                          .update(rawSignature)
                                          .digest('hex');

        console.log("Received Signature:", receivedSignature);
        console.log("Calculated Signature:", calculatedSignature);
        console.log("Raw Signature String for IPN:", rawSignature);


        // So sánh chữ ký tính toán với chữ ký nhận được
        return calculatedSignature === receivedSignature;
    }
}
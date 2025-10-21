import crypto from 'crypto';
import moment from 'moment'; // Hoặc dùng date-fns
import qs from 'qs';
import { env } from '../../config/env'; // File cấu hình biến môi trường của bạn
import { Order } from '../types/order.type';

export class VNPayService {
    private tmnCode: string;
    private hashSecret: string;
    private url: string;
    private returnUrl: string;

    constructor() {
        this.tmnCode = env.VNP_TMNCODE;
        this.hashSecret = env.VNP_HASHSECRET;
        this.url = env.VNP_URL;
        this.returnUrl = env.VNP_RETURN_URL; // Chỉ cần returnUrl ở đây
    }

    /**
     * Tạo URL để chuyển hướng khách hàng đến cổng thanh toán VNPay.
     * @param order Đối tượng đơn hàng vừa tạo trong DB.
     * @param amount Số tiền cần thanh toán (thường là order.total_amount).
     * @param ipAddr Địa chỉ IP của khách hàng.
     * @returns Chuỗi URL thanh toán VNPay.
     */
    createPaymentUrl(order: Order, amount: number, ipAddr: string): string {
        // VNPay yêu cầu định dạng YYYYMMDDHHmmss
        const createDate = moment(new Date()).format('YYYYMMDDHHmmss');
        // Sử dụng ID đơn hàng làm mã tham chiếu giao dịch (vnp_TxnRef), phải là duy nhất
        const orderId = order.id.toString();
        const orderInfo = `Thanh toan don hang ${order.order_number}`; // Mô tả đơn hàng
        const locale = 'vn'; // Ngôn ngữ giao diện cổng thanh toán
        const currCode = 'VND'; // Đơn vị tiền tệ

        let vnpParams: any = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': this.tmnCode,
            'vnp_Locale': locale,
            'vnp_CurrCode': currCode,
            'vnp_TxnRef': orderId,
            'vnp_OrderInfo': orderInfo,
            'vnp_OrderType': 'other', // Mã loại hàng hóa (vd: billpayment, fashion...)
            'vnp_Amount': Math.round(amount * 100), // Số tiền (phải nhân 100 và làm tròn)
            'vnp_ReturnUrl': this.returnUrl, // URL VNPay redirect về sau khi thanh toán
            'vnp_IpAddr': ipAddr, // IP của khách hàng
            'vnp_CreateDate': createDate, // Ngày tạo giao dịch
        };
        // Có thể thêm vnp_ExpireDate nếu muốn giới hạn thời gian thanh toán
        // const expireDate = moment(date).add(15, 'minutes').format('YYYYMMDDHHmmss');
        // vnpParams['vnp_ExpireDate'] = expireDate;

        // Sắp xếp các tham số theo thứ tự alphabet của key
        vnpParams = this.sortObject(vnpParams);

        // Tạo chuỗi dữ liệu để tạo chữ ký
        const signData = qs.stringify(vnpParams, { encode: false });
        // Tạo chữ ký HMAC SHA512
        const hmac = crypto.createHmac("sha512", this.hashSecret);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        // Thêm chữ ký vào tham số
        vnpParams['vnp_SecureHash'] = signed;
        // Tạo URL cuối cùng
        const paymentUrl = this.url + '?' + qs.stringify(vnpParams, { encode: false });

        return paymentUrl;
    }

    /**
     * Xác thực chữ ký điện tử trong dữ liệu VNPay gửi về (dùng cho cả Return và IPN).
     * @param vnpParams Object chứa các tham số VNPay gửi về (thường từ req.query).
     * @returns true nếu chữ ký hợp lệ, false nếu không hợp lệ.
     */
    verifySignature(vnpParams: any): boolean {
        const secureHash = vnpParams['vnp_SecureHash']; // Lấy chữ ký VNPay gửi về

        // Tạo một bản sao của params để xử lý, loại bỏ chữ ký khỏi bản sao này
        const paramsToVerify = { ...vnpParams };
        delete paramsToVerify['vnp_SecureHash'];
        delete paramsToVerify['vnp_SecureHashType']; // VNPay có thể gửi thêm trường này

        // Sắp xếp lại các tham số còn lại theo alphabet
        const sortedParams = this.sortObject(paramsToVerify);
        // Tạo chuỗi dữ liệu để tạo chữ ký kiểm tra
        const signData = qs.stringify(sortedParams, { encode: false });
        // Tạo chữ ký HMAC SHA512 từ dữ liệu và HashSecret của bạn
        const hmac = crypto.createHmac("sha512", this.hashSecret);
        const checkSignature = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        // So sánh chữ ký bạn tạo ra với chữ ký VNPay gửi về
        return secureHash === checkSignature;
    }

    /**
     * Hàm tiện ích: Sắp xếp các thuộc tính của object theo thứ tự alphabet của key.
     * VNPay yêu cầu điều này trước khi tạo chữ ký.
     */
    private sortObject(obj: any): any {
        let sorted: any = {};
        let keys = Object.keys(obj);
        keys.sort(); // Sắp xếp các key

        for (let key of keys) {
             // Sử dụng decodeURIComponent để xử lý đúng các ký tự đặc biệt nếu có trong value trước đó
             // Sau đó encode lại theo yêu cầu của VNPay
             sorted[key] = encodeURIComponent(decodeURIComponent(obj[key])).replace(/%20/g, "+");
        }
        return sorted;
    }
}
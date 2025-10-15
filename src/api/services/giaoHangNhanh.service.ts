import axios from 'axios';
import { IShippingProvider } from './shipping.interface';

export class GiaoHangNhanhService implements IShippingProvider {
    private apiKey: string;
    private shopId: number;
    private apiBaseUrl = 'https://dev-online-gateway.ghn.vn/shiip/public-api/v2';

    constructor(config: { apiKey: string, shopId: number }) {
        this.apiKey = config.apiKey;
        this.shopId = config.shopId;
    }

    async getAvailableServices(fromDistrictId: number, toDistrictId: number): Promise<any[]> {
        const response = await axios.post(`${this.apiBaseUrl}/shipping-order/available-services`, {
            shop_id: this.shopId,
            from_district: fromDistrictId,
            to_district: toDistrictId
        }, { headers: { 'Token': this.apiKey } });
        return response.data.data || [];
    }

    async calculateFee(orderInfo: any): Promise<any> {
        const response = await axios.post(`${this.apiBaseUrl}/shipping-order/fee`, orderInfo, {
            headers: { 'Token': this.apiKey, 'ShopId': this.shopId.toString() }
        });
        return response.data.data;
    }

    async getLeadTime(orderInfo: any): Promise<any> {
        const response = await axios.post(`${this.apiBaseUrl}/shipping-order/leadtime`, {
            from_district_id: orderInfo.from_district_id,
            from_ward_code: orderInfo.from_ward_code,
            to_district_id: orderInfo.to_district_id,
            to_ward_code: orderInfo.to_ward_code,
            service_id: orderInfo.service_id
        }, { headers: { 'Token': this.apiKey, 'ShopId': this.shopId.toString() } });
        return response.data.data;
    }

    async createOrder(orderInfo: any): Promise<any> {
        const payload = {
            ...orderInfo,
            shop_id: this.shopId,
            payment_type_id: 2, // 2: Người mua/nhận trả phí
            note: orderInfo.note || "",
            required_note: "CHOXEMHANGKHONGTHU", // Cho xem hàng, không cho thử
            // Thông tin kho hàng của bạn (nên lưu trong DB)
            from_name: "FruitApp Shop",
            from_phone: "0123456789",
            from_address: "123 Đường ABC",
            from_ward_code: "20109",
            from_district_id: 1442,
        };
        const response = await axios.post(`${this.apiBaseUrl}/shipping-order/create`, payload, {
            headers: { 'Token': this.apiKey, 'ShopId': this.shopId.toString() }
        });
        return response.data.data; // Trả về thông tin đơn hàng đã tạo trên GHN
    }
}
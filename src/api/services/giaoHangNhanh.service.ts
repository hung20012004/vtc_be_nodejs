import axios from 'axios';
import { IShippingProvider } from './shipping.interface';

export class GiaoHangNhanhService implements IShippingProvider {
    private apiKey: string;
    private shopId: number;
    private apiBaseUrl = 'https://dev-online-gateway.ghn.vn/shiip/public-api/v2'; // Using DEV endpoint

    constructor(config: { apiKey: string, shopId: number }) {
        this.apiKey = config.apiKey;
        this.shopId = config.shopId;
    }

    async getAvailableServices(fromDistrictId: number, toDistrictId: number): Promise<any[]> {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/shipping-order/available-services`, {
                shop_id: this.shopId,
                from_district: fromDistrictId,
                to_district: toDistrictId
            }, { headers: { 'Token': this.apiKey } });

            const allServices = response.data.data || [];

            // --- FILTERING STEP ---
            // Only keep services where service_type_id is 2
            const filteredServices = allServices.filter((service: any) => service.service_type_id === 2);
            // ---------------------

            return filteredServices; // Return the filtered list

        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error("Error fetching GHN available services:", error.response?.data || error.message);
            } else {
                console.error("Error fetching GHN available services:", error);
            }
            throw new Error("Could not fetch available shipping services."); // Re-throw a generic error
        }
    }

    async calculateFee(orderInfo: any): Promise<any> {
        // Add error handling similar to getAvailableServices if needed
        const response = await axios.post(`${this.apiBaseUrl}/shipping-order/fee`, orderInfo, {
            headers: { 'Token': this.apiKey, 'ShopId': this.shopId.toString() }
        });
        return response.data.data;
    }

    async getLeadTime(orderInfo: any): Promise<any> {
         // Add error handling similar to getAvailableServices if needed
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
         // Add error handling similar to getAvailableServices if needed
        const payload = {
            ...orderInfo,
            shop_id: this.shopId,
            payment_type_id: 2,
            note: orderInfo.note || "",
            required_note: "CHOXEMHANGKHONGTHU",
            // You should make the 'from' details configurable or load from DB
            from_name: "FruitApp Shop",
            from_phone: "0393337820",
            from_address: "123 Đường ABC",
            from_ward_code: "1A0601", // Example, ensure this is correct
            from_district_id: 1485,  // Example, ensure this is correct
        };
        const response = await axios.post(`${this.apiBaseUrl}/shipping-order/create`, payload, {
            headers: { 'Token': this.apiKey, 'ShopId': this.shopId.toString() }
        });
        return response.data.data;
    }
}
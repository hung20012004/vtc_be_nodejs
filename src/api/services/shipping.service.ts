import { GiaoHangNhanhService } from './giaoHangNhanh.service';
import { IShippingProvider } from './shipping.interface';
import pool from '../../config/db';

export class ShippingService {
    /**
     * "Factory" method: Quyết định và khởi tạo class service phù hợp
     * dựa trên mã nhà vận chuyển.
     * @param carrierCode - Mã định danh nhà vận chuyển (ví dụ: 'ghn', 'vtp').
     */
    private async getProvider(carrierCode: string): Promise<IShippingProvider> {
        // Lấy cấu hình (API key, Shop ID) từ database
        const result = await pool.query('SELECT api_config FROM shipping_carriers WHERE code = $1 AND is_active = true', [carrierCode]);
        if (result.rows.length === 0) {
            throw new Error(`Không tìm thấy nhà vận chuyển hoặc nhà vận chuyển không hoạt động: ${carrierCode}`);
        }
        const config = result.rows[0].api_config;

        // Dựa vào mã để trả về instance của class tương ứng
        switch (carrierCode) {
            case 'ghn':
                return new GiaoHangNhanhService({ apiKey: config.token, shopId: config.shop_id });
            // Tương lai có thể thêm các nhà vận chuyển khác ở đây
            // case 'vtp':
            //     return new ViettelPostService({ apiKey: config.api_key, user: config.user });
            default:
                throw new Error('Nhà vận chuyển không được hỗ trợ.');
        }
    }

    /**
     * Hàm chính: Lấy tất cả các lựa chọn vận chuyển (dịch vụ, phí, thời gian)
     * cho một đơn hàng.
     * @param carrierCode - Mã nhà vận chuyển.
     * @param orderData - Dữ liệu đơn hàng (địa chỉ, sản phẩm...).
     */
    async getShippingOptions(carrierCode: string, orderData: any) {
        const provider = await this.getProvider(carrierCode);

        // 1. Lấy danh sách các gói dịch vụ khả dụng cho tuyến đường này
        const availableServices = await provider.getAvailableServices(orderData.from_district_id, orderData.to_district_id);
        if (!availableServices || availableServices.length === 0) {
            return []; // Không có dịch vụ nào, trả về mảng rỗng
        }

        // 2. Với mỗi dịch vụ, gọi API tính phí và thời gian song song để tăng tốc
        const optionsPromises = availableServices.map(async (service) => {
            const feePayload = {
                from_district_id: orderData.from_district_id,
                from_ward_code: orderData.from_ward_code,
                to_district_id: orderData.to_district_id,
                to_ward_code: orderData.to_ward_code,
                service_id: service.service_id,
                service_type_id: service.service_type_id,
                weight: orderData.weight,
                length: orderData.length,
                width: orderData.width,
                height: orderData.height,
                insurance_value: orderData.insurance_value,
                items: orderData.items,
            };

            const leadTimePayload = {
                from_district_id: orderData.from_district_id,
                from_ward_code: orderData.from_ward_code,
                to_district_id: orderData.to_district_id,
                to_ward_code: orderData.to_ward_code,
                service_id: service.service_id,
            };
            
            try {
                // Gọi song song 2 API để tiết kiệm thời gian
                const [feeData, leadTimeData] = await Promise.all([
                    provider.calculateFee(feePayload),
                    provider.getLeadTime(leadTimePayload)
                ]);

                // 3. Tổng hợp kết quả thành một đối tượng dễ hiểu cho frontend
                return {
                    service_id: service.service_id,
                    service_name: service.short_name,
                    fee: feeData.total,
                    lead_time: leadTimeData.leadtime, // Giữ lại timestamp để xử lý ở FE nếu cần
                    lead_time_formatted: new Date(leadTimeData.leadtime * 1000).toLocaleDateString('vi-VN', { 
                        weekday: 'long', day: 'numeric', month: 'numeric' 
                    })
                };
            } catch (error) {
                // Nếu một dịch vụ bị lỗi (ví dụ: quá cân), bỏ qua và tiếp tục với các dịch vụ khác
                console.error(`Lỗi khi lấy thông tin cho service ID ${service.service_id}.`);
                return null;
            }
        });

        // Chờ tất cả các promise hoàn thành và lọc bỏ những kết quả bị lỗi (null)
        const options = (await Promise.all(optionsPromises)).filter(opt => opt !== null);
        return options;
    }

    /**
     * Hàm để tạo đơn hàng vận chuyển thực sự
     */
    async createOrder(carrierCode: string, orderInfo: any) {
        const provider = await this.getProvider(carrierCode);
        return provider.createOrder(orderInfo);
    }
}
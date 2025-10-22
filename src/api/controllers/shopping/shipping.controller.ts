import { Request, Response, NextFunction } from 'express';
import { ShippingService } from '../../services/shipping.service';

const shippingService = new ShippingService();

// --- THÔNG TIN KHO HÀNG CỦA BẠN ---
// Trong thực tế, bạn nên lưu thông tin này trong database và truy vấn ra.
const SHOP_ADDRESS = {
    districtId: 1485, // Ví dụ: Quận Hoàn Kiếm
    wardCode: "1A0601"   // Ví dụ: Phường Hàng Bạc
};

/**
 * API chính để lấy tất cả các lựa chọn vận chuyển (dịch vụ, phí, thời gian)
 * dựa trên địa chỉ và các sản phẩm trong giỏ hàng.
 */
export const getShippingOptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { carrierCode, to_district_id, to_ward_code, items } = req.body;
        
        // --- 1. Validation (Kiểm tra dữ liệu đầu vào) ---
        if (!carrierCode || !to_district_id || !to_ward_code || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin: carrierCode, to_district_id, to_ward_code, và mảng items.' });
        }

        // --- 2. Tính toán tổng cân nặng và giá trị từ mảng items ---
        let totalWeight = 0;
        let totalValue = 0;
        
        items.forEach((item: { quantity: number; weight: number; price: number }) => {
            if (typeof item.quantity !== 'number' || typeof item.weight !== 'number' || typeof item.price !== 'number') {
                throw new Error('Dữ liệu item không hợp lệ.');
            }
            // Cân nặng của sản phẩm (gram) nhân với số lượng
            totalWeight += item.weight * item.quantity;
            totalValue += item.price * item.quantity;
        });

        // --- 3. Ước tính kích thước gói hàng (Phương án Hộp Mặc Định) ---
        const packageInfo = {
            weight: Math.round(totalWeight + 200), // Cộng thêm 200g cho vỏ hộp và làm tròn
            length: 30, // cm
            width: 20,  // cm
            height: 15, // cm
            insurance_value: totalValue,
        };
        
        // --- 4. Chuẩn bị dữ liệu đầy đủ để gọi Service ---
        const orderData = {
            to_district_id: parseInt(to_district_id),
            to_ward_code: to_ward_code,
            items: items, // Giữ lại mảng items gốc để service có thể dùng
            ...packageInfo, // Ghi đè weight và thêm các kích thước
            from_district_id: SHOP_ADDRESS.districtId,
            from_ward_code: SHOP_ADDRESS.wardCode,
        };

        // 5. Gọi Service để thực hiện logic chính
        const options = await shippingService.getShippingOptions(carrierCode, orderData);
        
        res.status(200).json(options);
    } catch (error) {
        next(error);
    }
};
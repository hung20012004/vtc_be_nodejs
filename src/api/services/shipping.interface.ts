/**
 * Định nghĩa các hàm bắt buộc cho bất kỳ nhà cung cấp dịch vụ vận chuyển nào.
 * Đây là "hợp đồng" để đảm bảo các service (GHN, VTP...) có cùng phương thức.
 */
export interface IShippingProvider {
    /**
     * Lấy danh sách các gói dịch vụ vận chuyển khả dụng cho một tuyến đường.
     * @param fromDistrictId - Mã quận/huyện của người gửi.
     * @param toDistrictId - Mã quận/huyện của người nhận.
     */
    getAvailableServices(fromDistrictId: number, toDistrictId: number): Promise<any[]>;

    /**
     * Tính toán chi phí vận chuyển cho một đơn hàng cụ thể.
     * @param orderInfo - Thông tin chi tiết về đơn hàng (địa chỉ, cân nặng, kích thước...).
     */
    calculateFee(orderInfo: any): Promise<any>;

    /**
     * Lấy thời gian giao hàng dự kiến.
     * @param orderInfo - Thông tin về tuyến đường và gói dịch vụ.
     */
    getLeadTime(orderInfo: any): Promise<any>;

    /**
     * Tạo một đơn hàng vận chuyển thực sự trên hệ thống của đối tác.
     * @param orderInfo - Toàn bộ thông tin cần thiết để tạo đơn.
     */
    createOrder(orderInfo: any): Promise<any>;
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("../config/db")); // Đảm bảo đường dẫn này đúng
const GHN_TOKEN = '39c24d56-a813-11f0-bdaf-ae7fa045a771'; // <-- Thay token của bạn vào đây
const GHN_API_BASE = 'https://dev-online-gateway.ghn.vn/shiip/public-api';
const headers = { Token: GHN_TOKEN };
/**
 * Lấy và lưu dữ liệu Tỉnh/Thành phố
 */
const syncProvinces = async () => {
    console.log('Bắt đầu đồng bộ Tỉnh/Thành phố...');
    const { data } = await axios_1.default.get(`${GHN_API_BASE}/master-data/province`, { headers });
    for (const province of data.data) {
        await db_1.default.query(`INSERT INTO provinces (code, name, full_name) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (code) DO NOTHING`, [province.ProvinceID.toString(), province.ProvinceName, province.ProvinceName]);
    }
    console.log(`Đã đồng bộ xong ${data.data.length} Tỉnh/Thành phố.`);
};
/**
 * Lấy và lưu dữ liệu Quận/Huyện
 */
const syncDistricts = async () => {
    console.log('Bắt đầu đồng bộ Quận/Huyện...');
    const provinces = await db_1.default.query('SELECT code FROM provinces');
    let totalDistricts = 0;
    for (const province of provinces.rows) {
        const provinceCode = province.code;
        const { data } = await axios_1.default.get(`${GHN_API_BASE}/master-data/district?province_id=${provinceCode}`, { headers });
        // =============================================================
        // === PHẦN SỬA LỖI NẰM Ở ĐÂY ===
        // Kiểm tra xem data.data có tồn tại và là một mảng hay không
        if (data && data.data && Array.isArray(data.data)) {
            for (const district of data.data) {
                await db_1.default.query(`INSERT INTO districts (code, name, full_name, province_code) 
                     VALUES ($1, $2, $3, $4) 
                     ON CONFLICT (code) DO NOTHING`, [district.DistrictID.toString(), district.DistrictName, district.DistrictName, provinceCode]);
                totalDistricts++;
            }
        }
        // =============================================================
    }
    console.log(`Đã đồng bộ xong ${totalDistricts} Quận/Huyện.`);
};
/**
 * Lấy và lưu dữ liệu Phường/Xã
 */
const syncWards = async () => {
    console.log('Bắt đầu đồng bộ Phường/Xã...');
    const districts = await db_1.default.query('SELECT code FROM districts');
    let totalWards = 0;
    for (const district of districts.rows) {
        const districtCode = district.code;
        try {
            const { data } = await axios_1.default.get(`${GHN_API_BASE}/master-data/ward?district_id=${districtCode}`, { headers });
            // Thêm bước kiểm tra tương tự cho phường/xã
            if (data && data.data && Array.isArray(data.data)) {
                for (const ward of data.data) {
                    await db_1.default.query(`INSERT INTO wards (code, name, full_name, district_code) 
                         VALUES ($1, $2, $3, $4) 
                         ON CONFLICT (code) DO NOTHING`, [ward.WardCode, ward.WardName, ward.WardName, districtCode]);
                    totalWards++;
                }
            }
        }
        catch (error) {
            console.error(`Lỗi khi lấy dữ liệu cho district_id: ${districtCode}`);
        }
    }
    console.log(`Đã đồng bộ xong ${totalWards} Phường/Xã.`);
};
/**
 * Hàm chính để chạy tuần tự
 */
const runSync = async () => {
    try {
        await syncProvinces();
        await syncDistricts();
        await syncWards();
        console.log('🎉 Đồng bộ dữ liệu địa chỉ thành công!');
    }
    catch (error) {
        console.error('Đã xảy ra lỗi trong quá trình đồng bộ:', error);
    }
    finally {
        await db_1.default.end(); // Đóng kết nối DB để script kết thúc
    }
};
runSync();

import { Request, Response, NextFunction } from 'express';
import pool from '../../../config/db';

/**
 * Lấy danh sách tất cả Tỉnh/Thành phố
 */
export const getProvinces = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query('SELECT code, name, full_name FROM provinces ORDER BY name ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách Quận/Huyện theo mã Tỉnh/Thành phố
 */
export const getDistrictsByProvince = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const provinceCode = req.params.provinceCode;
        if (!provinceCode) {
            return res.status(400).json({ message: 'Vui lòng cung cấp mã Tỉnh/Thành phố.' });
        }
        const result = await pool.query(
            'SELECT code, name, full_name FROM districts WHERE province_code = $1 ORDER BY name ASC',
            [provinceCode]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách Phường/Xã theo mã Quận/Huyện
 */
export const getWardsByDistrict = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const districtCode = req.params.districtCode;
        if (!districtCode) {
            return res.status(400).json({ message: 'Vui lòng cung cấp mã Quận/Huyện.' });
        }
        const result = await pool.query(
            'SELECT code, name, full_name FROM wards WHERE district_code = $1 ORDER BY name ASC',
            [districtCode]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};
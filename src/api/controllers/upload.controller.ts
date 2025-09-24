import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';

// Cấu hình Cloudinary một lần khi ứng dụng khởi động (có thể đặt ở file khác)
cloudinary.config({ 
  cloud_name: env.CLOUDINARY_CLOUD_NAME, 
  api_key: env.CLOUDINARY_API_KEY, 
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Tạo chữ ký cho việc upload file trực tiếp từ client lên Cloudinary.
 */
export const getCloudinarySignature = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Lấy các tham số mà client muốn ký
        // Ví dụ: thư mục, tags... Client sẽ phải gửi các tham số này y hệt khi upload
        const paramsToSign = req.body.paramsToSign || {};

        const timestamp = Math.round((new Date).getTime()/1000);

        // Tạo chữ ký từ server, bao gồm cả timestamp và các tham số khác
        const signature = cloudinary.utils.api_sign_request(
            {
                timestamp: timestamp,
                ...paramsToSign
            },
            env.CLOUDINARY_API_SECRET
        );

        res.status(200).json({ timestamp, signature });
    } catch (error) {
        next(error);
    }
};
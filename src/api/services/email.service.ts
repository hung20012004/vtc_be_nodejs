// src/api/services/email.service.ts
import nodemailer from 'nodemailer';
import { env } from '../../config/env';

// Cấu hình "phương tiện" vận chuyển email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.GMAIL_USER,       // Email của bạn
        pass: env.GMAIL_APP_PASSWORD, // Mật khẩu ứng dụng bạn tạo
    },
});

interface MailOptions {
    to: string;      // Email người nhận
    subject: string; // Tiêu đề email
    html: string;    // Nội dung email dạng HTML
}

/**
 * Hàm chung để gửi email
 * @param options - Thông tin người nhận, tiêu đề, và nội dung
 */
export const sendEmail = async (options: MailOptions) => {
    try {
        const mailOptions = {
            from: `"Nông Sản Sạch" <${env.GMAIL_USER}>`, // Tên và email người gửi
            to: options.to,
            subject: options.subject,
            html: options.html,
        };
        
        // Gửi email
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
        console.error('Error sending email:', error);
        // Ném lỗi để controller có thể bắt và xử lý
        throw new Error('Could not send email.'); 
    }
};
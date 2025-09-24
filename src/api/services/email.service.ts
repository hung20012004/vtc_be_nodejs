// src/api/services/email.service.ts
import nodemailer from 'nodemailer';
import { env } from '../../config/env';

// Cấu hình transporter (phương tiện vận chuyển email)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
    },
});

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

/**
 * Hàm gửi email
 * @param options - Thông tin người nhận, tiêu đề, nội dung HTML
 */
export const sendEmail = async (options: MailOptions) => {
    try {
        const mailOptions = {
            from: `"Your App Name" <${env.GMAIL_USER}>`, // Tên người gửi
            to: options.to,
            subject: options.subject,
            html: options.html,
        };
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        // Ném lỗi để controller có thể xử lý
        throw new Error('Could not send email.'); 
    }
};
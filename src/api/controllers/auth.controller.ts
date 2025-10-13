// src/api/controllers/auth.controller.ts

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../services/email.service'; 
import { env } from '../../config/env';
import { findUserByEmail, createUser } from '../models/user.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import * as UserModel from '../models/user.model';
import * as ResetTokenModel from '../models/password_reset.model';
import pool from '../../config/db';
import * as CustomerModel from '../models/customer.model'; 
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    // Sử dụng model để tìm người dùng
    const user = await findUserByEmail(email);

    // Gộp 2 lần kiểm tra thành một
    if (!user || !(await bcrypt.compare(password, user.password!))) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    // // Ghi log hoạt động
    await createActivityLog({
      user_id: user.id,
      action: 'login',
      details: 'User logged in successfully.',
      ip: req.ip ?? null,
      user_agent: req.get('User-Agent') ?? null,
    });

    // Tạo token
    const payload = { userId: user.id, roleId: user.role_id };
    const token = (jwt as any).sign(payload, env.JWT_SECRET, {
          expiresIn: env.JWT_EXPIRES_IN,
        });

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: { id: user.id, name: user.name, email: user.email, user_type: user.user_type, role_id: user.role_id },
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
    // Lấy một kết nối riêng từ pool để quản lý transaction
    const client = await pool.connect();

    try {
        const { name, email, password, phone } = req.body; // Thêm 'phone' nếu có
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin.' });
        }

        const existingUser = await UserModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email đã được sử dụng.' });
        }

        // Bắt đầu TRANSACTION
        await client.query('BEGIN');

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // 1. Tạo user BÊN TRONG TRANSACTION
        const newUser = await UserModel.createUser({
            name,
            email,
            password: hashedPassword,
            role_id: 2,           // Mặc định vai trò Khách hàng
            user_type: 2,         // Mặc định loại người dùng là Khách hàng
            status: 0,            // 0 = Chờ kích hoạt
            verification_token: verificationToken,
            verification_token_expires: new Date(Date.now() + 15 * 60 * 1000),
        }, client); // <-- Truyền client vào đây

        // 2. Tạo customer BÊN TRONG TRANSACTION
        await CustomerModel.createCustomer({
            name: newUser.name,
            email: newUser.email,
            phone: phone || null, // Lấy sđt từ request hoặc để null
            address: null,        // Địa chỉ có thể cập nhật sau
            user_id: newUser.id,  // Liên kết với user vừa tạo
        }, client); // <-- Truyền client vào đây

        // Nếu tất cả thành công, xác nhận TRANSACTION
        await client.query('COMMIT');

        // 3. Gửi email xác thực (chỉ thực hiện sau khi transaction thành công)
        const verificationURL = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email?token=${verificationToken}`;
        const emailHtml = `<h1>Xác thực tài khoản của bạn</h1><p>Vui lòng bấm vào link dưới đây để kích hoạt tài khoản:</p><a href="${verificationURL}">Kích hoạt ngay</a>`;
        
        await sendEmail({
            to: email,
            subject: 'Kích hoạt tài khoản Nông Sản Sạch',
            html: emailHtml,
        });

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản.',
        });
    } catch (error) {
        // Nếu có bất kỳ lỗi nào, HỦY BỎ TRANSACTION
        await client.query('ROLLBACK');
        next(error);
    } finally {
        // Luôn luôn giải phóng kết nối về lại pool
        client.release();
    }
};

// Hàm logout không thay đổi
export const logout = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công.',
  });
};
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        const user = await UserModel.findUserByEmail(email);

        // Kể cả khi không tìm thấy user, vẫn trả về thành công để tránh lộ thông tin
        if (user) {
            // 1. Tạo một token ngẫu nhiên
            const resetToken = crypto.randomBytes(32).toString('hex');
            
            // 2. Lưu token vào DB (chỉ lưu bản hash để tăng bảo mật)
            // (Trong ví dụ này, chúng ta lưu token gốc để đơn giản hóa, nhưng thực tế nên hash nó)
            await ResetTokenModel.createOrUpdateResetToken(email, resetToken);

            // 3. Gửi email cho người dùng (PHẦN QUAN TRỌNG)
            // Trong thực tế, bạn sẽ dùng một thư viện như Nodemailer để gửi email
            // const resetURL = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
            // await sendEmail({ email: user.email, subject: 'Yêu cầu khôi phục mật khẩu', message: `Link reset: ${resetURL}` });
            
            // Vì đây là API, chúng ta sẽ trả về token để bạn có thể test
            res.status(200).json({ 
                message: 'Nếu email tồn tại, một link khôi phục mật khẩu đã được gửi.',
                // Dòng này chỉ để test, không dùng trong production
                test_token: resetToken 
            });
        } else {
             res.status(200).json({ message: 'Nếu email tồn tại, một link khôi phục mật khẩu đã được gửi.' });
        }
    } catch (error) { next(error); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ message: 'Vui lòng cung cấp token và mật khẩu mới.' });
        }

        const tokenRecord = await ResetTokenModel.findTokenRecord(token);

        if (!tokenRecord) {
            return res.status(400).json({ message: 'Token không hợp lệ.' });
        }

        // Kiểm tra token hết hạn (ví dụ: 10 phút)
        const tokenAge = Date.now() - new Date(tokenRecord.created_at).getTime();
        if (tokenAge > 10 * 60 * 1000) { // 10 phút
            return res.status(400).json({ message: 'Token đã hết hạn.' });
        }

        // Cập nhật mật khẩu mới
        const hashedPassword = await bcrypt.hash(password, 10);
        await UserModel.updatePasswordByEmail(tokenRecord.email, hashedPassword);

        // Xóa token sau khi đã sử dụng
        await ResetTokenModel.deleteToken(tokenRecord.email);
        
        res.status(200).json({ message: 'Mật khẩu đã được cập nhật thành công.' });
    } catch (error) { next(error); }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send('Token xác thực không hợp lệ hoặc đã hết hạn.');
        }

        const user = await UserModel.findUserByVerificationToken(token as string);
        if (!user) {
            return res.status(400).send('Token xác thực không hợp lệ hoặc đã hết hạn.');
        }
        
        await UserModel.activateUser(user.id);
        
        // Chuyển hướng người dùng đến trang đăng nhập hoặc trang thông báo thành công
        // res.redirect('YOUR_FRONTEND_LOGIN_PAGE_URL');
        res.status(200).send('<h1>Xác thực email thành công!</h1><p>Bạn có thể đóng trang này và đăng nhập vào ứng dụng.</p>');
    } catch (error) {
        next(error);
    }
};
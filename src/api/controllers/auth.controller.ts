// src/api/controllers/auth.controller.ts

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { findUserByEmail, createUser } from '../models/user.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import * as UserModel from '../models/user.model';
import * as ResetTokenModel from '../models/password_reset.model';
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
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin.' });
    }

    // Sử dụng model để kiểm tra
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Sử dụng model để tạo người dùng với các giá trị mặc định
    const newUser = await createUser({
      name,
      email,
      password: hashedPassword,
      role_id: 2,         // Mặc định vai trò Khách hàng
      user_type: 2,       // Mặc định loại người dùng là Khách hàng
      status: 1,          // Mặc định là Hoạt động
    });

    // Tạo token
    const payload = { userId: newUser.id, roleId: newUser.role_id };
    const token = (jwt as any).sign(payload, env.JWT_SECRET, {
          expiresIn: env.JWT_EXPIRES_IN,
        });

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công.',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (error) {
    next(error);
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
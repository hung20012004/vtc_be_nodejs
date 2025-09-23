// src/api/controllers/auth.controller.ts

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { findUserByEmail, createUser } from '../models/user.model';
// import { createActivityLog } from '../models/userActivityLog.model';

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
    // await createActivityLog({
    //   user_id: user.id,
    //   action: 'login',
    //   details: 'User logged in successfully.',
    //   ip: req.ip,
    //   user_agent: req.get('User-Agent') || null,
    // });

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
// src/api/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as UserModel from '../../models/authentication/user.model';
import { sendEmail } from '../../services/email.service';
import { User } from '../../types/authentication/user.type';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
/**
 * Admin tạo tài khoản nhân viên mới.
 */
export const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, role_id } = req.body;

        // 1. Kiểm tra email đã tồn tại chưa
        const existingUser = await UserModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email đã được sử dụng.' });
        }

        // 2. Tạo mật khẩu ngẫu nhiên
        const temporaryPassword = crypto.randomBytes(8).toString('hex');

        // 3. Hash mật khẩu
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        
        // 4. Tạo người dùng trong DB
        const newUser = await UserModel.createUser({
            name,
            email,
            password: hashedPassword,
            role_id: role_id,
            user_type: 1, // 1 = Employee/Staff
            status: 1,    // 1 = Active
        });

        // 5. Gửi email chứa mật khẩu tạm thời
        const emailHtml = `
            <h1>Chào mừng bạn đến với hệ thống!</h1>
            <p>Tài khoản của bạn đã được tạo thành công.</p>
            <p>Vui lòng sử dụng thông tin dưới đây để đăng nhập:</p>
            <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Mật khẩu tạm thời:</strong> ${temporaryPassword}</li>
            </ul>
            <p>Bạn nên đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>
            <a href="YOUR_LOGIN_PAGE_URL">Đăng nhập ngay</a>
        `;
        
        await sendEmail({
            to: email,
            subject: 'Thông tin tài khoản nhân viên',
            html: emailHtml,
        });

        res.status(201).json({ 
            message: 'Tạo tài khoản nhân viên thành công và đã gửi email thông báo.',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role_id: newUser.role_id,
            },
        });
    } catch (error) {
        next(error);
    }
};
/**
 * Admin lấy danh sách tất cả người dùng.
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await UserModel.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

/**
 * Admin cập nhật thông tin nhân viên.
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updateData = req.body;

        // Không cho phép cập nhật mật khẩu qua API này để đảm bảo an toàn
        delete updateData.password;

        const updatedUser = await UserModel.updateUser(id, updateData);
        if (!updatedUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-user',
            details: `Admin updated info for user ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(updatedUser);
    } catch (error) {
        next(error);
    }
};

/**
 * Admin xóa (mềm) một nhân viên.
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const user = req.user as User;

        // Ngăn admin tự xóa tài khoản của chính mình
        if (id === user.id) {
            return res.status(400).json({ message: 'Bạn không thể xóa tài khoản của chính mình.' });
        }
        
        const success = await UserModel.softDeleteUser(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xóa.' });
        }
        
        await createActivityLog({
            user_id: user.id, action: 'delete-user',
            details: `Admin deleted user ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as StaffModel from '../models/staff.model';
import * as UserModel from '../models/user.model';
import { sendEmail } from '../services/email.service';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const createStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, role_id, branch_id } = req.body;
        const adminUser = req.user as User;

        if (!name || !email || !role_id) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ Tên, Email và Vai trò.' });
        }

        const existingUser = await UserModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email đã được sử dụng.' });
        }

        // Bước 1: Tạo mật khẩu tạm trong một biến cục bộ.
        const temporaryPassword = crypto.randomBytes(8).toString('hex');

        // Bước 2: Băm mật khẩu để lưu vào database.
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        
        // Bước 3: Tạo nhân viên. Mật khẩu đã băm được truyền vào, không phải mật khẩu gốc.
        const newStaff = await StaffModel.createStaff({
            name,
            email,
            password: hashedPassword,
            role_id,
            branch_id: branch_id || null,
        });

        // Bước 4: Gửi email chứa mật khẩu tạm.
        const emailHtml = `
            <h1>Chào mừng bạn đến với hệ thống Nông Sản Sạch!</h1>
            <p>Tài khoản nhân viên của bạn đã được tạo thành công bởi quản trị viên.</p>
            <p>Vui lòng sử dụng thông tin dưới đây để đăng nhập:</p>
            <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Mật khẩu tạm thời:</strong> ${temporaryPassword}</li>
            </ul>
            <p>Bạn nên đổi mật khẩu ngay sau lần đăng nhập đầu tiên để đảm bảo an toàn.</p>
            <a href="YOUR_ADMIN_LOGIN_PAGE_URL">Đăng nhập ngay</a>
        `;
        
        await sendEmail({
            to: email,
            subject: 'Thông tin tài khoản nhân viên - Nông Sản Sạch',
            html: emailHtml,
        });

        await createActivityLog({
            user_id: adminUser.id, action: 'create-staff',
            details: `Admin created staff account '${newStaff.name}' (ID: ${newStaff.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        // Bước 5: Trả về response.
        // Đối tượng `newStaff` được trả về từ model KHÔNG chứa mật khẩu.
        // Biến `temporaryPassword` chỉ tồn tại trong hàm này và không được gửi đi.
        res.status(201).json({ 
            message: 'Tạo tài khoản nhân viên thành công. Mật khẩu tạm thời đã được gửi đến email.',
            user: newStaff, // 🔐 An toàn: Không chứa mật khẩu
        });
    } catch (error) {
        next(error);
    }
};

export const getAllStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const staffList = await StaffModel.findAllStaff();
        res.status(200).json(staffList);
    } catch (error) { next(error); }
};

export const getStaffById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const staff = await StaffModel.findStaffById(id);
        if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
        res.status(200).json(staff);
    } catch (error) { next(error); }
};

export const updateStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const adminUser = req.user as User;
        
        const updatedStaff = await StaffModel.updateStaff(id, req.body);
        if (!updatedStaff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
        
        await createActivityLog({
            user_id: adminUser.id, action: 'update-staff',
            details: `Admin updated info for staff ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedStaff);
    } catch (error) { next(error); }
};

export const deleteStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const adminUser = req.user as User;

        if (id === adminUser.id) {
            return res.status(400).json({ message: 'Bạn không thể xóa tài khoản của chính mình.' });
        }
        
        const success = await StaffModel.softDeleteStaff(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy nhân viên để xóa.' });
        
        await createActivityLog({
            user_id: adminUser.id, action: 'delete-staff',
            details: `Admin deleted staff ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
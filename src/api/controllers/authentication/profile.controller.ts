import { Request, Response, NextFunction } from 'express';
import * as ProfileModel from '../../models/authentication/profile.model';
import * as UserModel from '../../models/authentication/user.model'; // Thêm import này
import { User } from '../../types/authentication/user.type';

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const loggedInUser = req.user as User; // Đây là user từ token

        // [SỬA LỖI]: Gọi lại DB để lấy thông tin user mới nhất và đáng tin cậy nhất
        const currentUser = await UserModel.findUserById(loggedInUser.id);

        if (!currentUser) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
        }

        let profile;
        // Bây giờ, kiểm tra trên đối tượng `currentUser` vừa lấy được
        if (currentUser.user_type == 2) { // Nếu là Khách hàng
            profile = await ProfileModel.getCustomerProfile(currentUser.id);
        } else { // Nếu là Nhân viên hoặc Admin
            profile = await ProfileModel.getStaffProfile(currentUser.id);
        }

        if (!profile) {
            // Lỗi này có thể xảy ra nếu data không nhất quán (vd: user_type=2 nhưng không có record trong bảng customers)
            return res.status(404).json({ message: 'Không thể tải thông tin chi tiết của profile.' });
        }
        
        res.status(200).json(profile);
    } catch (error) {
        next(error);
    }
};

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const loggedInUser = req.user as User;
        const currentUser = await UserModel.findUserById(loggedInUser.id);
        
        if (!currentUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        const dataToUpdate = req.body;
        let updatedProfile;

        // Áp dụng logic tương tự cho hàm update
        if (currentUser.user_type == 2) {
            updatedProfile = await ProfileModel.updateCustomerProfile(currentUser.id, dataToUpdate);
        } else {
            updatedProfile = await ProfileModel.updateStaffProfile(currentUser.id, dataToUpdate);
        }

        res.status(200).json(updatedProfile);
    } catch (error) {
        next(error);
    }
};

export const changeMyPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới.' });
        }
        
        const result = await ProfileModel.updateUserPassword(user.id, currentPassword, newPassword);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.status(200).json({ message: result.message });
    } catch (error) {
        next(error);
    }
};
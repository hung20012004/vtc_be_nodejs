import { Request, Response, NextFunction } from 'express';
import * as WishlistModel from '../models/wishlist.model';
import { User } from '../types/user.type';
import { findCustomerByUserId } from '../models/customer.model'; // Thêm import này

// Lấy wishlist của người dùng hiện tại
export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;

        // BƯỚC 1: Lấy thông tin customer từ user.id
        const customer = await findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng cho người dùng này.' });
        }

        // BƯỚC 2: Sử dụng customer.id để truy vấn wishlist
        const wishlistItems = await WishlistModel.getWishlistByCustomerId(customer.id);
        res.status(200).json(wishlistItems);
    } catch (error) {
        next(error);
    }
};

// Thêm sản phẩm vào wishlist
export const addItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'Vui lòng cung cấp productId.' });
        }

        // BƯỚC 1: Lấy thông tin customer từ user.id
        const customer = await findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });
        }

        // BƯỚC 2: Sử dụng customer.id để thêm sản phẩm
        await WishlistModel.addItemToWishlist(customer.id, productId);
        res.status(201).json({ message: 'Đã thêm sản phẩm vào danh sách yêu thích.' });
    } catch (error) {
        next(error);
    }
};

// Xóa sản phẩm khỏi wishlist
export const removeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const productId = parseInt(req.params.productId, 10);

        // BƯỚC 1: Lấy thông tin customer từ user.id
        const customer = await findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });
        }

        // BƯỚC 2: Sử dụng customer.id để xóa sản phẩm
        const success = await WishlistModel.removeItemFromWishlist(customer.id, productId);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong danh sách yêu thích.' });
        }
        res.status(204).send(); // 204 No Content
    } catch (error) {
        next(error);
    }
};
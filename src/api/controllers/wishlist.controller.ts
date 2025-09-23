// src/api/controllers/wishlist.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as WishlistModel from '../models/wishlist.model';
import { User } from '../types/user.type';

// Lấy wishlist của người dùng hiện tại
export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const wishlistItems = await WishlistModel.getWishlistByCustomerId(user.id);
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
        await WishlistModel.addItemToWishlist(user.id, productId);
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
        const success = await WishlistModel.removeItemFromWishlist(user.id, productId);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong danh sách yêu thích.' });
        }
        res.status(204).send(); // 204 No Content
    } catch (error) {
        next(error);
    }
};
// src/api/controllers/review.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as ReviewModel from '../models/review.model';
import { User } from '../types/user.type';

// Public: Lấy review cho trang sản phẩm
export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        const reviews = await ReviewModel.findApprovedByProductId(productId);
        res.status(200).json(reviews);
    } catch (error) { next(error); }
};

// Customer: Gửi review mới
export const submitReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User; // Giả sử user.id là customer_id
        const productId = parseInt(req.params.productId, 10);
        const newReview = await ReviewModel.create({ ...req.body, customer_id: user.id, product_id: productId });
        res.status(201).json({ message: 'Gửi đánh giá thành công. Đánh giá của bạn đang chờ duyệt.', data: newReview });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }
        next(error);
    }
};

// Admin: Quản lý review
export const moderateReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { status } = req.body;
        if (status !== 'approved' && status !== 'rejected') {
            return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
        }
        const updatedReview = await ReviewModel.updateStatus(id, status);
        if (!updatedReview) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
        res.status(200).json(updatedReview);
    } catch (error) { next(error); }
};
// src/api/controllers/coupon.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as CouponModel from '../models/coupon.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const getAllCoupons = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const coupons = await CouponModel.findAllCoupons();
        res.status(200).json(coupons);
    } catch (error) { next(error); }
};

export const getCouponById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const coupon = await CouponModel.findCouponById(id);
        if (!coupon) {
            return res.status(404).json({ message: 'Không tìm thấy mã giảm giá.' });
        }
        res.status(200).json(coupon);
    } catch (error) { next(error); }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newCoupon = await CouponModel.createCoupon(req.body, user.id);
        await createActivityLog({
            user_id: user.id, action: 'create-coupon',
            details: `User created coupon '${newCoupon.name}' (ID: ${newCoupon.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newCoupon);
    } catch (error) { next(error); }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedCoupon = await CouponModel.updateCoupon(id, req.body);
        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Không tìm thấy mã giảm giá để cập nhật.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-coupon',
            details: `User updated coupon ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedCoupon);
    } catch (error) { next(error); }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await CouponModel.deleteCoupon(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy mã giảm giá để xóa.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-coupon',
            details: `User deleted coupon ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
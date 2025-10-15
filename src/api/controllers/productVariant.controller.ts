import { Request, Response, NextFunction } from 'express';
import * as VariantModel from '../models/product_variant.model'; // Đã sửa tên model cho đúng
import { User } from '../types/user.type';
import { createActivityLog } from '../models/user_activity_logs.model';

export const getVariantsForProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        const variants = await VariantModel.findByProductId(productId);
        res.status(200).json(variants);
    } catch (error) { next(error); }
};

export const createVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        // req.body sẽ tự động chứa cả length, width, height nếu frontend gửi lên
        const newVariant = await VariantModel.create(productId, req.body);
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'create-variant',
            details: `User created variant '${newVariant.name}' for product ID ${productId}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newVariant);
    } catch (error) { next(error); }
};

export const updateVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const variantId = parseInt(req.params.variantId, 10);
        const updatedVariant = await VariantModel.update(variantId, req.body);
        if (!updatedVariant) {
            return res.status(404).json({ message: 'Không tìm thấy phiên bản sản phẩm.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-variant',
            details: `User updated variant ID: ${variantId}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedVariant);
    } catch (error) { next(error); }
};

export const deleteVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const variantId = parseInt(req.params.variantId, 10);
        const { success } = await VariantModel.deleteById(variantId);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy phiên bản sản phẩm.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-variant',
            details: `User deleted variant ID: ${variantId}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
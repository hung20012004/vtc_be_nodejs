// src/api/controllers/cart.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as CartModel from '../models/cart.model';
import { User } from '../types/user.type';

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const cartItems = await CartModel.getCartByCustomerId(user.id);
        res.status(200).json(cartItems);
    } catch (error) {
        next(error);
    }
};

export const addItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { productId, variantId, quantity } = req.body;
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ message: 'Vui lòng cung cấp productId và quantity hợp lệ.' });
        }
        await CartModel.addOrUpdateItem({ customerId: user.id, productId, variantId, quantity });
        const cartItems = await CartModel.getCartByCustomerId(user.id);
        res.status(200).json({ message: 'Cập nhật giỏ hàng thành công.', data: cartItems });
    } catch (error) {
        next(error);
    }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const itemId = parseInt(req.params.itemId, 10);
        const { quantity } = req.body;
        if (!quantity) {
            return res.status(400).json({ message: 'Vui lòng cung cấp quantity.'});
        }
        await CartModel.updateItemQuantity(itemId, user.id, quantity);
        const cartItems = await CartModel.getCartByCustomerId(user.id);
        res.status(200).json({ message: 'Cập nhật số lượng thành công.', data: cartItems });
    } catch (error) {
        next(error);
    }
};

export const removeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const itemId = parseInt(req.params.itemId, 10);
        const success = await CartModel.removeItem(itemId, user.id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng.' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        await CartModel.clearCart(user.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
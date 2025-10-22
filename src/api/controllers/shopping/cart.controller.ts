import { Request, Response, NextFunction } from 'express';
import { User } from '../../types/authentication/user.type';
import * as CartModel from '../../models/shopping/cart.model';
import * as CustomerModel from '../../models/authentication/customer.model';
import { findCustomerByUserId } from '../../models/authentication/customer.model';
export const getCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Hành động này chỉ dành cho khách hàng.' });
        }
        const cartItems = await CartModel.getCartByCustomerId(customer.id);
        res.status(200).json(cartItems);
    } catch (error) {
        next(error);
    }
};

export const addItemToCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const customer = await findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Không tìm thấy thông tin khách hàng.' });
        }

        const { variantId, quantity } = req.body;

        if (!variantId || !quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp variantId và số lượng hợp lệ.' });
        }

        const cartItem = await CartModel.addOrUpdateItem({
            customerId: customer.id,
            variantId,
            quantity
        });

        res.status(201).json(cartItem);
    } catch (error) {
        next(error);
    }
};
export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const cartItemId = parseInt(req.params.cartItemId, 10);
        const { quantity } = req.body;

        if (isNaN(cartItemId)) {
            return res.status(400).json({ message: 'ID sản phẩm trong giỏ hàng không hợp lệ.' });
        }
        if (quantity === undefined || quantity < 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp số lượng hợp lệ.' });
        }

        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Hành động này chỉ dành cho khách hàng.' });
        }
        
        if (quantity === 0) {
            await CartModel.removeItem(cartItemId, customer.id);
        } else {
            const success = await CartModel.updateItemQuantity(cartItemId, quantity, customer.id);
            if (!success) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng hoặc bạn không có quyền.' });
            }
        }

        const cartItems = await CartModel.getCartByCustomerId(customer.id);
        res.status(200).json({ message: 'Cập nhật số lượng thành công.', data: cartItems });
    } catch (error) {
        next(error);
    }
};

export const removeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const cartItemId = parseInt(req.params.cartItemId, 10);

        if (isNaN(cartItemId)) {
            return res.status(400).json({ message: 'ID sản phẩm trong giỏ hàng không hợp lệ.' });
        }
        
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Hành động này chỉ dành cho khách hàng.' });
        }

        const success = await CartModel.removeItem(cartItemId, customer.id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng hoặc bạn không có quyền.' });
        }
        
        const cartItems = await CartModel.getCartByCustomerId(customer.id);
        res.status(200).json({ message: 'Xóa sản phẩm thành công.', data: cartItems });
    } catch (error) {
        next(error);
    }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        
        const customer = await CustomerModel.findCustomerByUserId(user.id);
        if (!customer) {
            return res.status(403).json({ message: 'Hành động này chỉ dành cho khách hàng.' });
        }

        await CartModel.clearCart(customer.id);
        
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
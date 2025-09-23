// src/api/controllers/product.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as ProductModel from '../models/product.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search as string | undefined;
        const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
        
        const { products, total } = await ProductModel.findAllProducts({ limit, offset, search, categoryId });

        res.status(200).json({
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
            data: products,
        });
    } catch (error) {
        next(error);
    }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const product = await ProductModel.findProductById(id);
        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
        }
        res.status(200).json(product);
    } catch (error) {
        next(error);
    }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newProduct = await ProductModel.createProduct(req.body, user.id);
        await createActivityLog({
            user_id: user.id, action: 'create-product',
            details: `User created product '${newProduct.name}' (ID: ${newProduct.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newProduct);
    } catch (error) {
        next(error);
    }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedProduct = await ProductModel.updateProduct(id, req.body);
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-product',
            details: `User updated product ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedProduct);
    } catch (error) {
        next(error);
    }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await ProductModel.deleteProduct(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-product',
            details: `User deleted product ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
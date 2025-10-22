import { Request, Response, NextFunction } from 'express';
import * as ProductModel from '../../models/products/product.model'; // Dùng cho CRUD
import * as ProductQuery from '../../models/products/product.query'; // Dùng cho lọc/tìm kiếm
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const options = {
            limit,
            offset,
            search: req.query.search as string | undefined,
            categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
            isFeatured: req.query.isFeatured === 'true' ? true : undefined,
            sortBy: req.query.sortBy as 'price' | 'name' | 'created_at' | undefined,
            sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        };
        
        // Sử dụng model query
        const { products, total } = await ProductQuery.findAllProducts(options);

        res.status(200).json({
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
            data: products,
        });
    } catch (error) { next(error); }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        // Sử dụng model CRUD
        const product = await ProductModel.findProductById(id);
        if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
        res.status(200).json(product);
    } catch (error) { next(error); }
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
    } catch (error) { next(error); }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const user = req.user as User;
        // Sử dụng model CRUD
        const updatedProduct = await ProductModel.updateProduct(id, req.body);
        if (!updatedProduct) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
        await createActivityLog({
            user_id: user.id, action: 'update-product', details: `User updated product ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedProduct);
    } catch (error) { next(error); }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const user = req.user as User;
        // Sử dụng model CRUD
        const success = await ProductModel.deleteProduct(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
        await createActivityLog({
            user_id: user.id, action: 'delete-product', details: `User deleted product ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
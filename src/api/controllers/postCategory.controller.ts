import { Request, Response, NextFunction } from 'express';
import * as PostCategoryModel from '../models/postCategory.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newCategory = await PostCategoryModel.create(req.body);
        await createActivityLog({
            user_id: user.id,
            action: 'create-post-category',
            details: `User created post category '${newCategory.name}' (ID: ${newCategory.id})`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newCategory);
    } catch (error) {
        next(error);
    }
};

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await PostCategoryModel.findAll();
        res.status(200).json(categories);
    } catch (error) {
        next(error);
    }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID không hợp lệ.' });
        }
        const category = await PostCategoryModel.findById(id);
        if (!category) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
        }
        res.status(200).json(category);
    } catch (error) {
        next(error);
    }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID không hợp lệ.' });
        }
        const updatedCategory = await PostCategoryModel.update(id, req.body);
        if (!updatedCategory) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
        }
        await createActivityLog({
            user_id: user.id,
            action: 'update-post-category',
            details: `User updated post category ID: ${id}`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedCategory);
    } catch (error) {
        next(error);
    }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID không hợp lệ.' });
        }
        const success = await PostCategoryModel.remove(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
        }
        await createActivityLog({
            user_id: user.id,
            action: 'delete-post-category',
            details: `User deleted post category ID: ${id}`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
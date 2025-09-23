// src/api/controllers/category.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as CategoryModel from '../models/category.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

// Hàm helper để xây dựng cây danh mục
const buildCategoryTree = (categories: any[], parentId: number | null = null): any[] => {
    return categories
        .filter(category => category.parent_id === parentId)
        .map(category => ({
            ...category,
            children: buildCategoryTree(categories, category.id),
        }));
};

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await CategoryModel.getAllCategories();
        // Kiểm tra query param `tree` để quyết định trả về dạng cây hay dạng phẳng
        if (req.query.tree === 'true') {
            const categoryTree = buildCategoryTree(categories);
            return res.status(200).json(categoryTree);
        }
        res.status(200).json(categories);
    } catch (error) {
        next(error);
    }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const category = await CategoryModel.findCategoryById(id);
        if (!category) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
        }
        res.status(200).json(category);
    } catch (error) {
        next(error);
    }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newCategory = await CategoryModel.createCategory(req.body);
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'create-category',
            details: `User created category '${newCategory.name}' (ID: ${newCategory.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newCategory);
    } catch (error) {
        next(error);
    }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedCategory = await CategoryModel.updateCategory(id, req.body);
        if (!updatedCategory) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục để cập nhật.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-category',
            details: `User updated category ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedCategory);
    } catch (error) {
        next(error);
    }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await CategoryModel.deleteCategory(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục để xóa.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-category',
            details: `User deleted category ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
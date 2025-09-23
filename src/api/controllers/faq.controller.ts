// src/api/controllers/faq.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as FaqModel from '../models/faq.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

// == PUBLIC CONTROLLER ==
export const getPublicFaqs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const faqs = await FaqModel.findActiveFaqs();
        // Nhóm các câu hỏi theo category
        const groupedFaqs = faqs.reduce((acc, faq) => {
            const key = faq.category || 'Chung';
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(faq);
            return acc;
        }, {} as Record<string, any>);
        res.status(200).json(groupedFaqs);
    } catch (error) { next(error); }
};

// == ADMIN CONTROLLERS ==
export const getAllFaqs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const faqs = await FaqModel.findAllFaqs();
        res.status(200).json(faqs);
    } catch (error) { next(error); }
};

export const createFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newFaq = await FaqModel.createFaq(req.body, user.id);
        await createActivityLog({
            user_id: user.id, action: 'create-faq',
            details: `User created FAQ (ID: ${newFaq.id}): '${newFaq.question.substring(0, 50)}...'`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newFaq);
    } catch (error) { next(error); }
};

export const updateFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedFaq = await FaqModel.updateFaq(id, req.body);
        if (!updatedFaq) return res.status(404).json({ message: 'Không tìm thấy FAQ.' });
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-faq', details: `User updated FAQ ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedFaq);
    } catch (error) { next(error); }
};

export const deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await FaqModel.deleteFaq(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy FAQ.' });
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-faq', details: `User deleted FAQ ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
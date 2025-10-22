import { Request, Response, NextFunction } from 'express';
import * as TagModel from '../../models/settings/tag.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

export const createTag = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newTag = await TagModel.createTag(req.body);
        await createActivityLog({
            user_id: user.id, action: 'create-tag',
            details: `User created tag '${newTag.name}' (ID: ${newTag.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newTag);
    } catch (error) { next(error); }
};

export const getAllTags = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tags = await TagModel.getAllTags();
        res.status(200).json(tags);
    } catch (error) { next(error); }
};

export const getTagById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const tag = await TagModel.findTagById(id);
        if (!tag) return res.status(404).json({ message: 'Không tìm thấy thẻ.' });
        res.status(200).json(tag);
    } catch (error) { next(error); }
};

export const updateTag = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        const updatedTag = await TagModel.updateTag(id, req.body);
        if (!updatedTag) return res.status(404).json({ message: 'Không tìm thấy thẻ.' });
        await createActivityLog({
            user_id: user.id, action: 'update-tag',
            details: `User updated tag ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedTag);
    } catch (error) { next(error); }
};

export const deleteTag = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        const success = await TagModel.deleteTag(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy thẻ.' });
        await createActivityLog({
            user_id: user.id, action: 'delete-tag',
            details: `User deleted tag ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
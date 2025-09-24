// src/api/controllers/setting.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as SettingModel from '../models/setting.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

// == PUBLIC CONTROLLER ==
export const getPublicSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await SettingModel.findPublicSettings();
        // Chuyển đổi mảng thành object key-value cho dễ sử dụng
        const settingsObject = settings.reduce((obj, item) => {
            obj[item.key] = item.value;
            return obj;
        }, {} as Record<string, any>);
        res.status(200).json(settingsObject);
    } catch (error) { next(error); }
};

// == ADMIN CONTROLLERS ==
export const getAllSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await SettingModel.findAllSettings();
        res.status(200).json(settings);
    } catch (error) { next(error); }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settingsToUpdate = req.body;
        if (!Array.isArray(settingsToUpdate) || settingsToUpdate.length === 0) {
            return res.status(400).json({ message: 'Request body phải là một mảng các cài đặt.' });
        }
        
        const user = req.user as User;
        await SettingModel.updateSettings(settingsToUpdate);
        
        await createActivityLog({
            user_id: user.id, action: 'update-settings',
            details: `User updated ${settingsToUpdate.length} application settings.`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        
        res.status(200).json({ message: 'Cập nhật cài đặt thành công.' });
    } catch (error) { next(error); }
};
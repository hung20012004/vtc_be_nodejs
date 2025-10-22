// src/api/controllers/banner.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as BannerModel from '../../models/settings/banner.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

// Dành cho public
export const getPublicBanners = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { position } = req.query;
        if (!position) {
            return res.status(400).json({ message: 'Vui lòng cung cấp vị trí (position).' });
        }
        const banners = await BannerModel.findActiveBannersByPosition(position as string);
        res.status(200).json(banners);
    } catch (error) { next(error); }
};

// Dành cho admin
export const getAllBanners = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const banners = await BannerModel.findAllBanners();
        res.status(200).json(banners);
    } catch (error) { next(error); }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newBanner = await BannerModel.createBanner(req.body);
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'create-banner',
            details: `User created banner '${newBanner.title}' (ID: ${newBanner.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newBanner);
    } catch (error) { next(error); }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedBanner = await BannerModel.updateBanner(id, req.body);
        if (!updatedBanner) return res.status(404).json({ message: 'Không tìm thấy banner.' });
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-banner',
            details: `User updated banner ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedBanner);
    } catch (error) { next(error); }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await BannerModel.deleteBanner(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy banner.' });
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-banner',
            details: `User deleted banner ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
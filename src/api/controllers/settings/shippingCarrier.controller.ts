// src/api/controllers/shippingCarrier.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as CarrierModel from '../../models/shopping/shipping.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

export const getAllCarriers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const carriers = await CarrierModel.findAll();
        res.status(200).json(carriers);
    } catch (error) { next(error); }
};

export const createCarrier = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newCarrier = await CarrierModel.create(req.body);
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'create-carrier',
            details: `User created shipping carrier '${newCarrier.name}' (ID: ${newCarrier.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newCarrier);
    } catch (error) { next(error); }
};

export const updateCarrier = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updatedCarrier = await CarrierModel.update(id, req.body);
        if (!updatedCarrier) return res.status(404).json({ message: 'Không tìm thấy nhà vận chuyển.' });
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'update-carrier', details: `User updated shipping carrier ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedCarrier);
    } catch (error) { next(error); }
};

export const deleteCarrier = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await CarrierModel.deleteById(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy nhà vận chuyển.' });
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-carrier', details: `User deleted shipping carrier ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
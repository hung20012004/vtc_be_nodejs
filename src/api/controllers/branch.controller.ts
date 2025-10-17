import { Request, Response, NextFunction } from 'express';
import * as BranchModel from '../models/branch.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

export const createBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newBranch = await BranchModel.create(req.body);

        await createActivityLog({
            user_id: user.id,
            action: 'create-branch',
            details: `User created branch '${newBranch.name}' (ID: ${newBranch.id})`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });

        res.status(201).json(newBranch);
    } catch (error) { next(error); }
};

export const getAllBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branches = await BranchModel.findAll();
        res.status(200).json(branches);
    } catch (error) { next(error); }
};

export const getBranchById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        const branch = await BranchModel.findById(id);
        if (!branch) return res.status(404).json({ message: 'Không tìm thấy chi nhánh.' });
        res.status(200).json(branch);
    } catch (error) { next(error); }
};

export const updateBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: 'ID không hợp lệ.' });
        
        const updatedBranch = await BranchModel.update(id, req.body);
        if (!updatedBranch) return res.status(404).json({ message: 'Không tìm thấy chi nhánh.' });

        await createActivityLog({
            user_id: user.id,
            action: 'update-branch',
            details: `User updated branch ID: ${id}`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(updatedBranch);
    } catch (error) { next(error); }
};

export const deleteBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: 'ID không hợp lệ.' });

        const success = await BranchModel.remove(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy chi nhánh.' });

        await createActivityLog({
            user_id: user.id,
            action: 'delete-branch',
            details: `User deleted branch ID: ${id}`,
            ip: req.ip ?? null,
            user_agent: req.get('User-Agent') ?? null,
        });

        res.status(204).send();
    } catch (error) { next(error); }
};
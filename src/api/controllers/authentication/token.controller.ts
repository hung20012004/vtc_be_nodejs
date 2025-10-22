// src/api/controllers/token.controller.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as TokenModel from '../../models/authentication/token.model';
import { User } from '../../types/authentication/user.type';

export const listMyTokens = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const tokens = await TokenModel.findTokensByUserId(user.id);
        res.status(200).json(tokens);
    } catch (error) { next(error); }
};

export const createToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { name, abilities } = req.body;
        if (!name) return res.status(400).json({ message: 'Tên token là bắt buộc.' });

        // 1. Tạo token gốc (plain text)
        const plainTextToken = crypto.randomBytes(40).toString('hex');
        
        // 2. Hash token để lưu vào DB
        const hashedToken = await bcrypt.hash(plainTextToken, 10);
        
        // 3. Lưu vào DB
        await TokenModel.createToken(user.id, name, abilities || [], hashedToken);

        // 4. Trả về token gốc cho người dùng **CHỈ MỘT LẦN DUY NHẤT**
        res.status(201).json({
            message: 'Tạo token thành công. Hãy sao chép token dưới đây, bạn sẽ không thể xem lại nó.',
            token: plainTextToken
        });
    } catch (error) { next(error); }
};

export const deleteToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        const success = await TokenModel.deleteToken(id, user.id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy token.' });
        res.status(204).send();
    } catch (error) { next(error); }
};
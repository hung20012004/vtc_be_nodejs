// src/api/controllers/contact.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as ContactModel from '../models/contact.model';
import { createActivityLog } from '../models/user_activity_logs.model';
import { User } from '../types/user.type';

// == PUBLIC CONTROLLER ==
export const submitContactForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newContact = await ContactModel.createContact(req.body);
        // Tùy chọn: Gửi email thông báo cho admin ở đây
        res.status(201).json({ message: 'Gửi liên hệ thành công. Chúng tôi sẽ sớm phản hồi bạn.' });
    } catch (error) { next(error); }
};

// == ADMIN CONTROLLERS ==
export const getAllContacts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contacts = await ContactModel.findAllContacts();
        res.status(200).json(contacts);
    } catch (error) { next(error); }
};

export const getContactById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const contact = await ContactModel.findContactById(id);
        if (!contact) {
            return res.status(404).json({ message: 'Không tìm thấy liên hệ.' });
        }
        res.status(200).json(contact);
    } catch (error) { next(error); }
};

export const respondToContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const user = req.user as User;
        const { response } = req.body;
        if (!response) {
            return res.status(400).json({ message: 'Nội dung phản hồi là bắt buộc.' });
        }

        const updatedContact = await ContactModel.respondToContact(id, { response, responded_by: user.id });
        if (!updatedContact) {
            return res.status(404).json({ message: 'Không tìm thấy liên hệ để phản hồi.' });
        }
        
        // Ghi log
        await createActivityLog({
            user_id: user.id, action: 'respond-contact',
            details: `User responded to contact ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });

        res.status(200).json(updatedContact);
    } catch (error) { next(error); }
};

export const deleteContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const success = await ContactModel.deleteContact(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy liên hệ.' });
        }
        const user = req.user as User;
        await createActivityLog({
            user_id: user.id, action: 'delete-contact',
            details: `User deleted contact ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
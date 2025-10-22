// src/api/models/contact.model.ts
import pool from '../../../config/db';
import { Contact } from '../../types/shopping/contact.type';

export type CreateContactInput = Pick<Contact, 'name' | 'email' | 'phone' | 'subject' | 'message'>;
export type RespondContactInput = Pick<Contact, 'response' | 'responded_by'>;

// Public: Tạo liên hệ mới
export const createContact = async (data: CreateContactInput): Promise<Contact> => {
    const { name, email, phone, subject, message } = data;
    const result = await pool.query(
        'INSERT INTO contacts (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, email, phone, subject, message]
    );
    return result.rows[0];
};

// Admin: Lấy tất cả liên hệ
export const findAllContacts = async (): Promise<Contact[]> => {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    return result.rows;
};

// Admin: Tìm liên hệ theo ID
export const findContactById = async (id: number): Promise<Contact | null> => {
    const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

// Admin: Phản hồi một liên hệ
export const respondToContact = async (id: number, data: RespondContactInput): Promise<Contact | null> => {
    const { response, responded_by } = data;
    const result = await pool.query(
        'UPDATE contacts SET response = $1, responded_by = $2, responded_at = NOW(), status = 2 WHERE id = $3 RETURNING *',
        [response, responded_by, id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

// Admin: Xóa một liên hệ
export const deleteContact = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
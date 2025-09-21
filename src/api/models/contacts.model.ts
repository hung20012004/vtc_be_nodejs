import pool from '../../config/db';
import { Contact } from '../types/contacts.type';

export type CreateContactInput = Pick<Contact, 'name' | 'email' | 'phone' | 'subject' | 'message' | 'status'>;

export const findContactById = async (id: number): Promise<Contact | null> => {
  const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllContacts = async (): Promise<Contact[]> => {
  const result = await pool.query('SELECT * FROM contacts');
  return result.rows;
};

export const createContact = async (data: CreateContactInput): Promise<Contact> => {
  const { name, email, phone, subject, message, status } = data;
  const result = await pool.query(
    `INSERT INTO contacts (name, email, phone, subject, message, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, email, phone, subject, message, status]
  );
  return result.rows[0];
};

export const updateContact = async (
  id: number,
  data: Partial<CreateContactInput>
): Promise<Contact | null> => {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key in data) {
    fields.push(`${key} = $${idx}`);
    values.push((data as any)[key]);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteContact = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
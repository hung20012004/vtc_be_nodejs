// src/api/models/category.model.ts

import pool from '../../../config/db';
import { Category, CategoryTreeNode } from '../../types/products/category.type';

export type CreateCategoryInput = Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export const getAllCategories = async (): Promise<Category[]> => {
    const result = await pool.query('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC');
    return result.rows;
};

export const findCategoryById = async (id: number): Promise<Category | null> => {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const createCategory = async (data: CreateCategoryInput): Promise<Category> => {
    const { name, slug, description, image, parent_id, sort_order, is_active } = data;
    const result = await pool.query(
        `INSERT INTO categories (name, slug, description, image, parent_id, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, slug, description, image, parent_id, sort_order, is_active]
    );
    return result.rows[0];
};

export const updateCategory = async (id: number, data: UpdateCategoryInput): Promise<Category | null> => {
    const fields = Object.keys(data).map((key, index) => `"${key}" = $${index + 1}`);
    if (fields.length === 0) return findCategoryById(id);

    const values = Object.values(data);
    const query = `UPDATE categories SET ${fields.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteCategory = async (id: number): Promise<boolean> => {
    // Soft delete
    const result = await pool.query('UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
    return (result.rowCount ?? 0) > 0;
};
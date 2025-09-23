import pool from '../../config/db';
import { Product } from '../types/products.type';

export type CreateProductInput = Pick<Product, 'name' | 'slug' | 'sku' | 'category_id' | 'unit_id' | 'description' | 'images' | 'price' | 'stock_quantity' | 'is_active'>;

export const findProductById = async (id: number): Promise<Product | null> => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllProducts = async (): Promise<Product[]> => {
  const result = await pool.query('SELECT * FROM products');
  return result.rows;
};

export const createProduct = async (data: CreateProductInput): Promise<Product> => {
  const { name, slug, sku, category_id, unit_id, description, images, price, stock_quantity, is_active } = data;
  const result = await pool.query(
    `INSERT INTO products (name, slug, sku, category_id, unit_id, description, images, price, stock_quantity, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [name, slug, sku, category_id, unit_id, description, images, price, stock_quantity, is_active]
  );
  return result.rows[0];
};

export const updateProduct = async (
  id: number,
  data: Partial<CreateProductInput>
): Promise<Product | null> => {
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
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteProduct = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
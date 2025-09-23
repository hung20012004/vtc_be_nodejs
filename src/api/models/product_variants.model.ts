import pool from '../../config/db';
import { ProductVariant } from '../types/product_variants.type';

export type CreateProductVariantInput = Pick<ProductVariant, 'product_id' | 'name' | 'sku' | 'price' | 'stock_quantity'>;

export const findProductVariantById = async (id: number): Promise<ProductVariant | null> => {
  const result = await pool.query('SELECT * FROM product_variants WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllProductVariants = async (): Promise<ProductVariant[]> => {
  const result = await pool.query('SELECT * FROM product_variants');
  return result.rows;
};

export const createProductVariant = async (data: CreateProductVariantInput): Promise<ProductVariant> => {
  const { product_id, name, sku, price, stock_quantity } = data;
  const result = await pool.query(
    `INSERT INTO product_variants (product_id, name, sku, price, stock_quantity) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [product_id, name, sku, price, stock_quantity]
  );
  return result.rows[0];
};

export const updateProductVariant = async (
  id: number,
  data: Partial<CreateProductVariantInput>
): Promise<ProductVariant | null> => {
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
    `UPDATE product_variants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteProductVariant = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM product_variants WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
import pool from '../../config/db';
import { ProductReview } from '../types/product_reviews.type';

export type CreateProductReviewInput = Pick<ProductReview, 'product_id' | 'customer_id' | 'rating' | 'comment' | 'created_at'>;

export const findProductReviewById = async (id: number): Promise<ProductReview | null> => {
  const result = await pool.query('SELECT * FROM product_reviews WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const getAllProductReviews = async (): Promise<ProductReview[]> => {
  const result = await pool.query('SELECT * FROM product_reviews');
  return result.rows;
};

export const createProductReview = async (data: CreateProductReviewInput): Promise<ProductReview> => {
  const { product_id, customer_id, rating, comment, created_at } = data;
  const result = await pool.query(
    `INSERT INTO product_reviews (product_id, customer_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [product_id, customer_id, rating, comment, created_at]
  );
  return result.rows[0];
};

export const updateProductReview = async (
  id: number,
  data: Partial<CreateProductReviewInput>
): Promise<ProductReview | null> => {
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
    `UPDATE product_reviews SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteProductReview = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM product_reviews WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
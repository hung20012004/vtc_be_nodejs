// src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Định nghĩa schema cho tất cả các biến môi trường
const envSchema = z.object({
  // App Config
  PORT: z.string().default('5000'),

  // Database Config
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_DATABASE: z.string(),

  // JWT Config
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),
  
  // Gmail Config
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string(),

  // Cloudinary Config
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  VNP_TMNCODE: z.string(),
  VNP_HASHSECRET: z.string(),
  VNP_URL: z.string().url(),
  VNP_RETURN_URL: z.string().url(),
  VNP_IPN_URL: z.string().url(),

  FRONTEND_URL: z.string().url(),
    // --- THÊM MOMO CONFIG ---
  MOMO_PARTNER_CODE: z.string(),
   MOMO_ACCESS_KEY: z.string(),
    MOMO_SECRET_KEY: z.string(),
    MOMO_API_ENDPOINT: z.string().url(),
    MOMO_REDIRECT_URL: z.string().url(),
    MOMO_IPN_URL: z.string().url(),
});

// Phân tích và xác thực các biến môi trường
export const env = envSchema.parse(process.env);

// Kiểm tra kiểu để đảm bảo type-safety
export type Env = z.infer<typeof envSchema>;
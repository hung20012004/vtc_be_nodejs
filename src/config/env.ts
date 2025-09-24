// src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Định nghĩa schema cho các biến môi trường
const envSchema = z.object({
  PORT: z.string().default('5000'),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),
  
  // -- THÊM 2 DÒNG NÀY VÀO --
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string(),
  // -------------------------
});

// Phân tích và xác thực các biến môi trường
export const env = envSchema.parse(process.env);

// Kiểm tra kiểu để đảm bảo type-safety
export type Env = z.infer<typeof envSchema>;
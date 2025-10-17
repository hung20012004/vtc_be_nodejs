// src/api/types/user.type.ts

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  email_verified_at: Date | null;
  password?: string; 
  role_id: number;
  address: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  avatar: string | null;
  status: number; // 0: Chờ kích hoạt, 1: Hoạt động, 2: Bị khóa
  user_type: number;
  activated_at: Date | null;
  remember_token: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  branch_id?: number | null;
}
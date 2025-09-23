// src/api/types/contact.type.ts
export interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  status: number; // 0: Mới, 1: Đã đọc, 2: Đã phản hồi
  response: string | null;
  responded_by: number | null;
  responded_at: Date | null;
  created_at: Date;
}
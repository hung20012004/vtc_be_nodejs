// src/api/types/faq.type.ts
export interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  views: number;
  is_active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}
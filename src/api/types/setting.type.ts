// src/api/types/setting.type.ts
export interface Setting {
  id: number;
  key: string;
  value: string | null;
  type: string;
  group: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}
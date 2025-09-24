// src/api/types/token.type.ts
export interface PersonalAccessToken {
  id: number;
  tokenable_type: string;
  tokenable_id: number;
  name: string;
  token: string;
  abilities: string[] | null;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}
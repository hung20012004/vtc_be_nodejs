export interface PersonalAccessToken {
  id: number;
  tokenable_type: string;
  tokenable_id: number;
  name: string;
  token: string;
  abilities?: string;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}
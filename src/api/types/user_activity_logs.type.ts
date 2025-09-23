export interface UserActivityLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}
export interface UserActivityLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  ip: string;
  user_agent: string;
  created_at: Date;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string | null;
  data: Record<string, any> | null; // JSONB
  read_at: Date | null;
  created_at: Date;
}
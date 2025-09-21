export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  data: string;
  read_at: string;
}
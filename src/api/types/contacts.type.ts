export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  status?: string;
  created_at: Date;
}
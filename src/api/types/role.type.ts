export interface Role {
  id: number;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
  description?: string;
}
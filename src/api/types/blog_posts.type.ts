export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content?: string;
  author_id?: number;
  category_id?: number;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
}
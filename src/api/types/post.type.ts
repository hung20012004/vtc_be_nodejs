// src/api/types/post.type.ts
export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  category_id: number | null;
  views: number;
  is_featured: boolean;
  is_published: boolean;
  published_at: Date | null;
  seo_title: string | null;
  seo_description: string | null;
  author_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface BlogCategory {
    id: number;
    name: string;
    slug: string;
}
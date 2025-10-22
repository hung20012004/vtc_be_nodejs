import { Tag } from './../settings/tag.type';

export interface PostCategory {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parent_id: number | null;
    created_at: Date;
    updated_at: Date;
}

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
    author_id: number | null;
    created_at: Date;
    updated_at: Date;
    // Các trường được JOIN thêm
    author_name?: string;
    category_name?: string;
    tags?: Tag[];
}
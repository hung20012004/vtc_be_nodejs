// src/api/types/category.type.ts

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// Kiểu dữ liệu cho danh mục có chứa các danh mục con (lồng nhau)
export interface CategoryTreeNode extends Category {
    children: CategoryTreeNode[];
}
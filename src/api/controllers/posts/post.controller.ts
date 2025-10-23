import { Request, Response, NextFunction } from 'express';
import * as PostModel from '../../models/posts/post.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

// Helper để xử lý lỗi
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Đã xảy ra lỗi.') => {
    console.error("Post Controller Error:", error);
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

// ===========================================
// == PUBLIC API
// ===========================================

export const getAllPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const posts = await PostModel.findAll(limit, offset);
        // Cần thêm query đếm tổng số bài viết để phân trang
        // const total = await PostModel.countAll(); 
        // res.status(200).json({ data: posts, pagination: { total, page, limit } });
        res.status(200).json(posts); // Tạm thời trả về mảng
    } catch (error) { 
        handleError(res, error, 'Lỗi khi lấy danh sách bài viết.');
    }
};

export const getPostBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        if (!slug) {
            return res.status(400).json({ message: 'Slug không được để trống.'});
        }
        const post = await PostModel.findBySlug(slug);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết hoặc bài viết chưa được xuất bản.' });
        res.status(200).json(post);
    } catch (error) { 
        handleError(res, error, 'Lỗi khi lấy bài viết theo slug.');
    }
};

// ===========================================
// == ADMIN API
// ===========================================

/**
 * [HÀM MỚI] Admin lấy chi tiết bài viết theo ID (để chỉnh sửa/xem trước)
 */
export const getPostById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idParam = req.params.id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: `ID không hợp lệ: ${idParam}`});
        }

        const post = await PostModel.findPostById(id);
        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết với ID này.' });
        }
        res.status(200).json(post);
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy chi tiết bài viết.');
    }
};

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newPost = await PostModel.create(req.body, user.id);
        await createActivityLog({
            user_id: user.id, action: 'create-post',
            details: `User created post '${newPost.title}' (ID: ${newPost.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        // Trả về dữ liệu đầy đủ (bao gồm cả tags) bằng cách gọi lại hàm findPostById
        const createdPostDetails = await PostModel.findPostById(newPost.id);
        res.status(201).json(createdPostDetails);
    } catch (error) { 
        handleError(res, error, 'Lỗi khi tạo bài viết.');
    }
};

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const idParam = req.params.id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: `ID không hợp lệ: ${idParam}`});
        }
        
        const updatedPost = await PostModel.update(id, req.body);
        if (!updatedPost) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        
        await createActivityLog({
            user_id: user.id, action: 'update-post',
            details: `User updated post ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedPost); // Hàm update đã trả về dữ liệu đầy đủ
    } catch (error) { 
        handleError(res, error, 'Lỗi khi cập nhật bài viết.');
    }
};

export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const idParam = req.params.id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: `ID không hợp lệ: ${idParam}`});
        }

        const success = await PostModel.remove(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        
        await createActivityLog({
            user_id: user.id, action: 'delete-post',
            details: `User deleted post ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { 
        handleError(res, error, 'Lỗi khi xóa bài viết.');
    }
};

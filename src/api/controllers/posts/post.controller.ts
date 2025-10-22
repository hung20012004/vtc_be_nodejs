import { Request, Response, NextFunction } from 'express';
import * as PostModel from '../../models/posts/post.model';
import { createActivityLog } from '../../models/authentication/user_activity_logs.model';
import { User } from '../../types/authentication/user.type';

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const newPost = await PostModel.create(req.body, user.id);
        await createActivityLog({
            user_id: user.id, action: 'create-post',
            details: `User created post '${newPost.title}' (ID: ${newPost.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newPost);
    } catch (error) { next(error); }
};

export const getAllPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        const posts = await PostModel.findAll(limit, offset);
        res.status(200).json(posts);
    } catch (error) { next(error); }
};

export const getPostBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const post = await PostModel.findBySlug(slug);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        res.status(200).json(post);
    } catch (error) { next(error); }
};

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        const updatedPost = await PostModel.update(id, req.body);
        if (!updatedPost) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        await createActivityLog({
            user_id: user.id, action: 'update-post',
            details: `User updated post ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(200).json(updatedPost);
    } catch (error) { next(error); }
};

export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const id = parseInt(req.params.id, 10);
        const success = await PostModel.remove(id);
        if (!success) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        await createActivityLog({
            user_id: user.id, action: 'delete-post',
            details: `User deleted post ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
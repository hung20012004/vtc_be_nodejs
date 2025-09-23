// src/api/controllers/post.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as PostModel from '../models/post.model';
import { User } from '../types/user.type';
import { createActivityLog } from '../models/user_activity_logs.model';

// == PUBLIC CONTROLLERS ==
export const getPublishedPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const posts = await PostModel.findAllPublishedPosts();
        res.status(200).json(posts);
    } catch (error) { next(error); }
};

export const getPostBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostModel.findPublishedPostBySlug(req.params.slug);
        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        }
        res.status(200).json(post);
    } catch (error) { next(error); }
};

// == ADMIN CONTROLLERS ==
export const getAllPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const posts = await PostModel.findAllPosts();
        res.status(200).json(posts);
    } catch (error) { next(error); }
};

export const getPostById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const post = await PostModel.findPostById(id);
        if (!post) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        }
        res.status(200).json(post);
    } catch (error) { next(error); }
};

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const { tagIds, ...postData } = req.body;
        const newPost = await PostModel.createPost(postData, user.id, tagIds);
        await createActivityLog({
            user_id: user.id, action: 'create-post',
            details: `User created post '${newPost.title}' (ID: ${newPost.id})`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(201).json(newPost);
    } catch (error) { next(error); }
};

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { tagIds, ...postData } = req.body;
        const user = req.user as User;
        const updatedPost = await PostModel.updatePost(id, postData, tagIds);
        if (!updatedPost) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết để cập nhật.' });
        }
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
        const id = parseInt(req.params.id, 10);
        const user = req.user as User;
        const success = await PostModel.deletePost(id);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết để xóa.' });
        }
        await createActivityLog({
            user_id: user.id, action: 'delete-post',
            details: `User deleted post ID: ${id}`,
            ip: req.ip ?? null, user_agent: req.get('User-Agent') ?? null,
        });
        res.status(204).send();
    } catch (error) { next(error); }
};
// src/api/routes/token.route.ts
import express from 'express';
import * as TokenController from '../../controllers/authentication/token.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = express.Router();

// Người dùng phải đăng nhập để quản lý token của chính họ
router.use(protect);

router.route('/')
  .get(TokenController.listMyTokens)
  .post(TokenController.createToken);

router.delete('/:id', TokenController.deleteToken);

export default router;
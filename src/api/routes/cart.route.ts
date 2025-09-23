// src/api/routes/cart.route.ts
import express from 'express';
import * as CartController from '../controllers/cart.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route giỏ hàng đều yêu cầu người dùng phải đăng nhập
router.use(protect);

router.route('/')
    .get(CartController.getCart)
    .post(CartController.addItem)
    .delete(CartController.clearCart);

router.route('/:itemId')
    .patch(CartController.updateItem)
    .delete(CartController.removeItem);

export default router;
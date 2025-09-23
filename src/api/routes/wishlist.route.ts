// src/api/routes/wishlist.route.ts
import express from 'express';
import * as WishlistController from '../controllers/wishlist.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route wishlist đều yêu cầu người dùng phải đăng nhập
router.use(protect);

router.route('/')
    .get(WishlistController.getWishlist)
    .post(WishlistController.addItem);

router.delete('/:productId', WishlistController.removeItem);

export default router;
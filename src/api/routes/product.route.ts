// src/api/routes/product.route.ts
import express from 'express';
import * as ProductController from '../controllers/product.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import * as VariantController from '../controllers/productVariant.controller';
const router = express.Router();

// Route lấy danh sách sản phẩm và chi tiết sản phẩm là công khai
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

// Các route thay đổi dữ liệu cần quyền 'manage-products'
router.post('/', protect, authorize('manage-products'), ProductController.createProduct);
router.patch('/:id', protect, authorize('manage-products'), ProductController.updateProduct);
router.delete('/:id', protect, authorize('manage-products'), ProductController.deleteProduct);

// == ADMIN ROUTES FOR VARIANTS ==
const variantRouter = express.Router({ mergeParams: true });
variantRouter.use(protect, authorize('manage-products'));

variantRouter.route('/')
    .get(VariantController.getVariantsForProduct)
    .post(VariantController.createVariant);
    
variantRouter.route('/:variantId')
    .patch(VariantController.updateVariant)
    .delete(VariantController.deleteVariant);

router.use('/:productId/variants', variantRouter);
export default router;
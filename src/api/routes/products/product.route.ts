import express from 'express';
import * as ProductController from '../../controllers/products/product.controller';
import { protect, authorize } from '../../middlewares/auth.middleware';
import * as VariantController from '../../controllers/products/productVariant.controller';

const router = express.Router();

router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

router.post('/', protect, authorize('manage-products'), ProductController.createProduct);
router.patch('/:id', protect, authorize('manage-products'), ProductController.updateProduct);
router.delete('/:id', protect, authorize('manage-products'), ProductController.deleteProduct);
const variantRouter = express.Router({ mergeParams: true });
variantRouter.get('/', VariantController.getVariantsForProduct);

variantRouter.post('/', protect, authorize('manage-products'), VariantController.createVariant);
variantRouter.patch('/:variantId', protect, authorize('manage-products'), VariantController.updateVariant);
variantRouter.delete('/:variantId', protect, authorize('manage-products'), VariantController.deleteVariant);

// Gắn router con vào router chính
router.use('/:productId/variants', variantRouter);

export default router;
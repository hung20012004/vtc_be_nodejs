// src/api/routes/shippingCarrier.route.ts
import express from 'express';
import * as CarrierController from '../controllers/shippingCarrier.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Yêu cầu quyền 'manage-inventory' hoặc một quyền mới 'manage-shipping'
router.use(protect, authorize('manage-inventory')); 

router.route('/')
  .get(CarrierController.getAllCarriers)
  .post(CarrierController.createCarrier);

router.route('/:id')
  .patch(CarrierController.updateCarrier)
  .delete(CarrierController.deleteCarrier);

export default router;
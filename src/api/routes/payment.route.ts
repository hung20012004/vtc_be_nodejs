import express from 'express';
import * as PaymentController from '../controllers/payment.controller';

const router = express.Router();

router.get('/vnpay_return', PaymentController.handleVnpayReturn);
router.get('/vnpay_ipn', PaymentController.handleVnpayIPN);

export default router;
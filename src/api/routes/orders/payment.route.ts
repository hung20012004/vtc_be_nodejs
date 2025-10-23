import express from 'express';
import * as PaymentController from '../../controllers/orders/payment.controller'; // Adjust path if needed

const router = express.Router();

// --- VNPay Routes ---
// User redirection after payment attempt (GET)
router.get('/vnpay_return', PaymentController.handleVnpayReturn);
// Server-to-server notification from VNPay (GET)
router.get('/vnpay_ipn', PaymentController.handleVnpayIPN);

// --- MoMo Routes ---
// User redirection after payment attempt (GET)
router.get('/momo_return', PaymentController.handleMomoReturn);
// Server-to-server notification from MoMo (POST)
router.post('/momo_ipn', PaymentController.handleMomoIPN);

export default router;
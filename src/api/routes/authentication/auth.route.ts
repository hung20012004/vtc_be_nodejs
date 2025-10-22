// src/api/routes/auth.route.ts
import express from 'express';
import { login, register, logout, forgotPassword, resetPassword,verifyEmail } from '../../controllers/authentication/auth.controller'; 
import { protect } from '../../middlewares/auth.middleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout); 
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);
export default router;
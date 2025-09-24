// src/api/routes/auth.route.ts
import express from 'express';
import { login, register, logout, forgotPassword, resetPassword } from '../controllers/auth.controller'; 
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout); 
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
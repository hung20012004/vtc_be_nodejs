
import express from 'express';
import { login, register, logout } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware'; 

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout); 

export default router;
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import pool from '../../config/db';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Không được phép, không có token.' });
    }

    const decoded: any = jwt.verify(token, env.JWT_SECRET);
    const currentUser = await pool.query('SELECT id, name, email, role_id FROM users WHERE id = $1', [decoded.userId]);

    if (currentUser.rows.length === 0) {
      return res.status(401).json({ message: 'Người dùng sở hữu token này không còn tồn tại.' });
    }
    req.user = currentUser.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};
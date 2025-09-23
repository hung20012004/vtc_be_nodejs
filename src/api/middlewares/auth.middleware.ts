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

/**
 * Middleware để kiểm tra xem vai trò của người dùng có các quyền hạn cần thiết hay không.
 * @param requiredPermissions - Một mảng các slug của quyền hạn bắt buộc.
 */
export const authorize = (...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực.' });
    }

    try {
      // 1. Lấy tất cả các quyền (permissions) mà vai trò (role) của người dùng đang có
      const userPermissionsQuery = await pool.query(
        `SELECT p.slug FROM permissions p
         JOIN permission_role pr ON p.id = pr.permission_id
         WHERE pr.role_id = $1`,
        [req.user.role_id]
      );

      // Lấy ra một mảng các slug, ví dụ: ['manage-users', 'view-products']
      const userPermissions: string[] = userPermissionsQuery.rows.map(row => row.slug);

      // 2. Kiểm tra xem người dùng có TẤT CẢ các quyền được yêu cầu hay không
      const hasAllRequiredPermissions = requiredPermissions.every(p => userPermissions.includes(p));

      if (hasAllRequiredPermissions) {
        next(); // Có đủ quyền, cho phép đi tiếp
      } else {
        return res.status(403).json({ message: 'Bạn không có đủ quyền hạn để thực hiện hành động này.' });
      }
    } catch (error) {
      next(error);
    }
  };
};
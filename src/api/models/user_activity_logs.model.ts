  // src/api/models/userActivityLog.model.ts

  import pool from '../../config/db';
  import { UserActivityLog } from '../types/user_activity_logs.type';

  // Định nghĩa kiểu dữ liệu cho việc tạo một log mới
  type CreateLogInput = Omit<UserActivityLog, 'id' | 'created_at' | 'updated_at'>;

  /**
   * Ghi lại một hoạt động của người dùng vào database.
   */
  export const createActivityLog = async (logData: CreateLogInput): Promise<UserActivityLog> => {
    const { user_id, action, details, ip, user_agent } = logData;

    const result = await pool.query(
      `INSERT INTO user_activity_logs (user_id, action, details, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [user_id, action, details, ip, user_agent]
    );

    return result.rows[0];
  };

  /**
   * Lấy danh sách lịch sử hoạt động có phân trang.
   * @param limit - Số lượng bản ghi mỗi trang.
   * @param offset - Vị trí bắt đầu lấy bản ghi.
   * @returns - Mảng các bản ghi log và tổng số lượng.
   */
  export const getAllLogs = async (limit: number, offset: number): Promise<{ logs: any[], total: number }> => {
      // Câu query để lấy dữ liệu log, join với bảng users để lấy tên người dùng
      const logsQuery = pool.query(
          `SELECT
              ual.id,
              ual.action,
              ual.details,
              ual.ip,
              ual.user_agent,
              ual.created_at,
              u.id as user_id,
              u.name as user_name,
              u.email as user_email
          FROM user_activity_logs ual
          LEFT JOIN users u ON ual.user_id = u.id
          ORDER BY ual.created_at DESC
          LIMIT $1 OFFSET $2`,
          [limit, offset]
      );

      // Câu query để đếm tổng số bản ghi
      const totalQuery = pool.query('SELECT COUNT(*) FROM user_activity_logs');

      // Chạy cả 2 query song song để tối ưu hiệu suất
      const [logsResult, totalResult] = await Promise.all([logsQuery, totalQuery]);

      return {
          logs: logsResult.rows,
          total: parseInt(totalResult.rows[0].count, 10),
      };
  };
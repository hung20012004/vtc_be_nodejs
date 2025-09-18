import dotenv from 'dotenv';

dotenv.config();

/**
 * Hàm này dùng để kiểm tra và lấy biến môi trường.
 * Nếu biến không tồn tại, nó sẽ dừng chương trình ngay lập tức.
 * @param name Tên của biến môi trường
 * @returns Giá trị của biến môi trường
 */
function getEnvVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1); 
  }
  return value;
}

// Định nghĩa và export các biến môi trường đã được xác thực
export const env = {
  JWT_SECRET: getEnvVariable('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVariable('JWT_EXPIRES_IN'),
  PORT: getEnvVariable('PORT'),
};
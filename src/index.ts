
import app from './app';
import { env } from './config/env'; // Import từ file env an toàn
import cors from 'cors';
app.use(cors({
  origin: [
    'https://ffresh.io.vn',   // FE chính thức
    'http://localhost:3000'   // dùng khi dev
  ],
  credentials: true
}));
const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
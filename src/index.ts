
import app from './app';
import { env } from './config/env'; // Import từ file env an toàn

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
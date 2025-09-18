// src/app.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import các router
// import userRouter from './api/routes/user.route'; 
import authRouter from './api/routes/auth.route'; 

const app = express();

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser()); 
// 2. Cấu hình Routes
app.use('/api/v1/auth', authRouter); 
// app.use('/api/v1/users', userRouter); 

app.get('/', (req, res) => {
  res.send('Server is alive and kicking!');
});

export default app;
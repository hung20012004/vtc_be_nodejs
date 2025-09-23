// src/app.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import các router
// import userRouter from './api/routes/user.route'; 
import authRouter from './api/routes/auth.route'; 
import roleRouter from './api/routes/role.route';
import permissionRouter from './api/routes/permission.route'; 
import userActivityLogRouter from './api/routes/userActivityLog.route';
import customerRouter from './api/routes/customer.route';
import unitRouter from './api/routes/unit.route';
import categoryRouter from './api/routes/category.route';
import productRouter from './api/routes/product.route';

const app = express();

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser()); 
// 2. Cấu hình Routes
app.use('/api/v1/auth', authRouter); 
app.use('/api/v1/roles', roleRouter);
app.use('/api/v1/permissions', permissionRouter);
app.use('/api/v1/logs', userActivityLogRouter);
app.use('/api/v1/customers', customerRouter);
app.use('/api/v1/units', unitRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/products', productRouter);


app.get('/', (req, res) => {
  res.send('Server is alive and kicking!');
});

export default app;
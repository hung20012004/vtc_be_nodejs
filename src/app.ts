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
import wishlistRouter from './api/routes/wishlist.route';
import cartRouter from './api/routes/cart.route';
import notificationRouter from './api/routes/notification.route';
import supplierRouter from './api/routes/supplier.route';
import inventoryRouter from './api/routes/inventoryImport.route';
import couponRouter from './api/routes/coupon.route';
import bannerRouter from './api/routes/banner.route';
import contactRouter from './api/routes/contact.route';
import reportRouter from './api/routes/report.route';
import failedJobRouter from './api/routes/failedJob.route';
import postRouter from './api/routes/post.route';
import faqRouter from './api/routes/faq.route';


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
app.use('/api/v1/wishlist', wishlistRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/suppliers', supplierRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/coupons', couponRouter);
app.use('/api/v1/banners', bannerRouter);
app.use('/api/v1/contacts', contactRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/failed-jobs', failedJobRouter);
app.use('/api/v1/posts', postRouter);
app.use('/api/v1/faqs', faqRouter);

app.get('/', (req, res) => {
  res.send('Server is alive and kicking!');
});

export default app;
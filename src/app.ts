// src/app.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import các router
// import userRouter from './api/routes/user.route'; 
import authRouter from './api/routes/authentication/auth.route'; 
import roleRouter from './api/routes/authentication/role.route';
import permissionRouter from './api/routes/authentication/permission.route'; 
import userActivityLogRouter from './api/routes/authentication/userActivityLog.route';
import customerRouter from './api/routes/authentication/customer.route';
import unitRouter from './api/routes/products/unit.route';
import categoryRouter from './api/routes/products/category.route';
import productRouter from './api/routes/products/product.route';
import wishlistRouter from './api/routes/shopping/wishlist.route';
import cartRouter from './api/routes/shopping/cart.route';
import notificationRouter from './api/routes/shopping/notification.route';
import supplierRouter from './api/routes/settings/supplier.route';
import inventoryRouter from './api/routes/inventory/inventory.route';
import couponRouter from './api/routes/shopping/coupon.route';
import bannerRouter from './api/routes/settings/banner.route';
import contactRouter from './api/routes/shopping/contact.route';
import failedJobRouter from './api/routes/settings/failedJob.route';
import postRouter from './api/routes/posts/post.route';
import faqRouter from './api/routes/shopping/faq.route';
import settingRouter from './api/routes/settings/setting.route';
import shippingRouter from './api/routes/shopping/shipping.route';
import tokenRouter from './api/routes/authentication/token.route';
import reviewRouter from './api/routes/shopping/review.route';
import userRouter from './api/routes/authentication/user.route';
import uploadRouter from './api/routes/settings/upload.route';
import orderRouter from './api/routes/orders/order.route';
import locationRouter from './api/routes/locations/location.route';
import branchRouter from './api/routes/locations/branch.route';
import tagRouter from './api/routes/settings/tag.route';
import postCategoryRouter from './api/routes/posts/postCategory.route';
import staffRouter from './api/routes/authentication/staff.route';
import profileRouter from './api/routes/authentication/profile.route';
const app = express();

app.use(cors({
  origin: [
    'https://admin.ffresh.io.vn',   // FE chính thức
    'http://localhost:3000'   // dùng khi dev
  ],
  credentials: true
}));
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
app.use('/api/v1/failed-jobs', failedJobRouter);
app.use('/api/v1/posts', postRouter);
app.use('/api/v1/faqs', faqRouter);
app.use('/api/v1/settings', settingRouter);
app.use('/api/v1/shipping', shippingRouter);
app.use('/api/v1/tokens', tokenRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/uploads', uploadRouter);
app.use('/api/v1/locations', locationRouter);
app.use('/api/v1/branches', branchRouter);
app.use('/api/v1/tags', tagRouter);
app.use('/api/v1/post-categories', postCategoryRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/profile', profileRouter);

app.get('/', (req, res) => {
  res.send('Server is alive and kicking!');
});

export default app;
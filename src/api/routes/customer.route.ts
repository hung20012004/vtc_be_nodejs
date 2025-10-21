import express from 'express';
import * as CustomerController from '../controllers/customer.controller';
import * as AddressController from '../controllers/customerAddress.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// ==========================================================
// == API DÀNH CHO KHÁCH HÀNG TỰ QUẢN LÝ ĐỊA CHỈ CỦA MÌNH ==
// ==========================================================
// Các route này chỉ cần `protect` để đảm bảo người dùng đã đăng nhập.
// Controller sẽ tự kiểm tra quyền sở hữu.
const selfAddressRouter = express.Router();
selfAddressRouter.use(protect);

selfAddressRouter.route('/')
    .get(AddressController.getCustomerAddresses)
    .post(AddressController.addCustomerAddress);

selfAddressRouter.route('/:addressId')
    .patch(AddressController.updateCustomerAddress)
    .delete(AddressController.deleteCustomerAddress);

// Gắn router quản lý địa chỉ của chính mình vào đường dẫn /addresses
router.use('/addresses', selfAddressRouter);


// ==========================================================
// == API DÀNH CHO ADMIN QUẢN LÝ KHÁCH HÀNG ==
// ==========================================================
// Các route này phải được định nghĩa SAU CÙNG.
// Middleware authorize sẽ được áp dụng.
router.use(protect, authorize('manage-customers'));

router.route('/')
    .get(CustomerController.getAllCustomers)
    .post(CustomerController.createCustomer);

// Route động /:id phải nằm ở cuối cùng để không "chặn" các route khác
router.route('/:id')
    .get(CustomerController.getCustomerById)
    .patch(CustomerController.updateCustomer)
    .delete(CustomerController.deleteCustomer);


export default router;
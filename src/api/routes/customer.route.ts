// src/api/routes/customer.route.ts
import express from 'express';
import * as CustomerController from '../controllers/customer.controller';
import * as AddressController from '../controllers/customerAddress.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Route cho CRUD khách hàng (chỉ admin)
router.use(protect, authorize('manage-customers'));
router.route('/')
  .get(CustomerController.getAllCustomers)
  .post(CustomerController.createCustomer);
router.route('/:id')
  .get(CustomerController.getCustomerById)
  .patch(CustomerController.updateCustomer)
  .delete(CustomerController.deleteCustomer);

// Route cho quản lý địa chỉ của một khách hàng (chỉ admin hoặc chính khách hàng đó)
// Chúng ta sẽ cần một middleware mới để kiểm tra quyền sở hữu
router.route('/:customerId/addresses')
    .get(AddressController.getCustomerAddresses)
    .post(AddressController.addCustomerAddress);

router.route('/:customerId/addresses/:addressId')
    .patch(AddressController.updateCustomerAddress)
    .delete(AddressController.deleteCustomerAddress);


export default router;
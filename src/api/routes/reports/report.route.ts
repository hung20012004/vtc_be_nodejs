import express from 'express';
import * as ReportController from '../../controllers/reports/report.controller'; // Adjust path if needed
import { protect, authorize } from '../../middlewares/auth.middleware'; // Adjust path if needed

const router = express.Router();

// Apply middleware: require login and 'view-reports' permission for all report routes
router.use(protect, authorize('view-reports'));

// --- Sales & Revenue Reports ---
router.get('/revenue/overview', ReportController.getRevenueOverviewReport);       // Tổng quan
router.get('/revenue/by-period', ReportController.getRevenueByTimePeriodReport);  // Theo ngày/tuần/tháng/năm (query param 'period')
router.get('/revenue/by-payment-method', ReportController.getRevenueByPaymentMethodReport); // Theo PTTT
router.get('/revenue/by-province', ReportController.getRevenueByProvinceReport); // Theo tỉnh/thành

// --- Order Reports ---
router.get('/orders/status-counts', ReportController.getOrderStatusCountsReport); // Số lượng theo trạng thái

// --- Product Reports ---
router.get('/products/top-selling', ReportController.getTopSellingProductsReport); // Top bán chạy (SL/Doanh thu)
router.get('/products/revenue-by-category', ReportController.getRevenueByCategoryReport); // Doanh thu theo danh mục

// --- Customer Reports ---
router.get('/customers/top', ReportController.getTopCustomersReport);             // Top khách hàng (Doanh thu/Số đơn)
router.get('/customers/new-trend', ReportController.getNewCustomersTrendReport); // Khách hàng mới theo thời gian

// --- Inventory Reports ---
router.get('/inventory/stock-levels', ReportController.getStockLevelsReport);     // Tồn kho chi tiết (lọc branch, low stock, search)
router.get('/inventory/value', ReportController.getInventoryValueReport);         // Giá trị tồn kho (lọc branch)
router.get('/inventory/imports', ReportController.getImportHistoryReport);        // Lịch sử nhập kho (lọc branch?, date)
router.get('/inventory/exports', ReportController.getExportHistoryReport);        // Lịch sử xuất kho (lọc branch, type, date)
router.get('/inventory/adjustments', ReportController.getInventoryAdjustmentsReport); // Lịch sử điều chỉnh kiểm kho (lọc branch, date)

export default router;
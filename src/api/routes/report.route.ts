// src/api/routes/report.route.ts
import express from 'express';
import * as ReportController from '../controllers/report.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

// Tất cả các route báo cáo đều yêu cầu quyền 'view-dashboard'
router.use(protect, authorize('view-dashboard'));

router.get('/daily-sales', ReportController.getDailyReports);
router.post('/daily-sales/generate', ReportController.triggerReportGeneration);

export default router;
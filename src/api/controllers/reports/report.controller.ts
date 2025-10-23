import { Request, Response, NextFunction } from 'express';
import * as ReportModel from '../../models/reports/report.model'; // Adjust path if needed

// --- Helper Functions ---
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Lỗi khi lấy dữ liệu báo cáo.') => {
    console.error("Report Controller Error:", error);
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

const getTimeRange = (req: Request): { startDate: string; endDate: string } | null => {
    const { startDate, endDate } = req.query;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string' || !dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return null;
    }
    if (new Date(startDate) > new Date(endDate)) {
        return null;
    }
    return { startDate, endDate };
};

const getBranchId = (req: Request): number | undefined => {
    const { branchId } = req.query;
    if (branchId === undefined || branchId === null || branchId === '') return undefined;
    const id = parseInt(branchId as string, 10);
    return isNaN(id) ? undefined : id;
};

const getPagination = (req: Request): { limit: number; offset: number, page: number } => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    return { limit, offset, page };
};

// --- Sales & Revenue Reports ---

export const getRevenueOverviewReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const overview = await ReportModel.getRevenueOverview(timeRange);
        res.status(200).json(overview);
    } catch (error) { handleError(res, error); }
};

export const getRevenueByTimePeriodReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        const period = (req.query.period as string)?.toLowerCase() || 'day';
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        if (!['day', 'week', 'month', 'year'].includes(period)) {
            return res.status(400).json({ message: "period phải là 'day', 'week', 'month', hoặc 'year'." });
        }
        const data = await ReportModel.getRevenueByTimePeriod({ ...timeRange, period: period as any });
        res.status(200).json(data);
    } catch (error) { handleError(res, error); }
};

export const getOrderStatusCountsReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const counts = await ReportModel.getOrderStatusCounts(timeRange);
        res.status(200).json(counts);
    } catch (error) { handleError(res, error); }
};

export const getRevenueByPaymentMethodReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const data = await ReportModel.getRevenueByPaymentMethod(timeRange);
        res.status(200).json(data);
    } catch (error) { handleError(res, error); }
};

export const getRevenueByProvinceReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const data = await ReportModel.getRevenueByProvince(timeRange);
        res.status(200).json(data);
    } catch (error) { handleError(res, error); }
};

// --- Product Reports ---

export const getTopSellingProductsReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const limit = parseInt(req.query.limit as string) || 10;
        const sortBy = (req.query.sortBy as string)?.toLowerCase() === 'revenue' ? 'revenue' : 'quantity';

        const topProducts = await ReportModel.getTopSellingItems({ ...timeRange, limit, sortBy });
        res.status(200).json(topProducts);
    } catch (error) { handleError(res, error); }
};

export const getRevenueByCategoryReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const data = await ReportModel.getRevenueByCategory(timeRange);
        res.status(200).json(data);
    } catch (error) { handleError(res, error); }
};

// --- Customer Reports ---

export const getTopCustomersReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const limit = parseInt(req.query.limit as string) || 10;
        const sortBy = (req.query.sortBy as string)?.toLowerCase() === 'orders' ? 'orders' : 'revenue';

        const topCustomers = await ReportModel.getTopCustomers({ ...timeRange, limit, sortBy });
        res.status(200).json(topCustomers);
    } catch (error) { handleError(res, error); }
};

export const getNewCustomersTrendReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        const period = (req.query.period as string)?.toLowerCase() || 'day';
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
         if (!['day', 'month', 'year'].includes(period)) {
            return res.status(400).json({ message: "period phải là 'day', 'month', hoặc 'year'." });
        }
        const data = await ReportModel.getNewCustomersTrend({ ...timeRange, period: period as any });
        res.status(200).json(data);
    } catch (error) { handleError(res, error); }
};


// --- Inventory Reports ---

export const getStockLevelsReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branchId = getBranchId(req);
        const lowStock = req.query.lowStock === 'true';
        const search = req.query.search as string | undefined;

        const stockLevels = await ReportModel.getCurrentStockLevels({ branchId, lowStock, search });
        res.status(200).json(stockLevels);
    } catch (error) { handleError(res, error); }
};

export const getInventoryValueReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branchId = getBranchId(req);
        const value = await ReportModel.getInventoryValue({ branchId });
        res.status(200).json(value);
    } catch (error) { handleError(res, error); }
};

export const getImportHistoryReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const { limit, offset, page } = getPagination(req);
        const branchId = getBranchId(req); // Optional branch filter

        const { data, total } = await ReportModel.getImportHistory({ ...timeRange, limit, offset, branchId });
        res.status(200).json({
            data,
            pagination: { currentPage: page, limit, totalPages: Math.ceil(total / limit), totalItems: total }
        });
    } catch (error) { handleError(res, error); }
};

export const getExportHistoryReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const { limit, offset, page } = getPagination(req);
        const branchId = getBranchId(req);
        const type = req.query.type ? parseInt(req.query.type as string, 10) : undefined;
        if (type !== undefined && isNaN(type)) return res.status(400).json({ message: 'Loại (type) không hợp lệ.' });

        const { data, total } = await ReportModel.getExportHistory({ ...timeRange, limit, offset, branchId, type });
        res.status(200).json({
            data,
            pagination: { currentPage: page, limit, totalPages: Math.ceil(total / limit), totalItems: total }
        });
    } catch (error) { handleError(res, error); }
};

export const getInventoryAdjustmentsReport = async(req: Request, res: Response, next: NextFunction) => {
     try {
        const timeRange = getTimeRange(req);
        if (!timeRange) return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate hợp lệ (YYYY-MM-DD).' });
        const { limit, offset, page } = getPagination(req);
        const branchId = getBranchId(req);

        const { data, total } = await ReportModel.getInventoryAdjustments({ ...timeRange, limit, offset, branchId });
         res.status(200).json({
            data,
            pagination: { currentPage: page, limit, totalPages: Math.ceil(total / limit), totalItems: total }
        });
    } catch (error) { handleError(res, error); }
};
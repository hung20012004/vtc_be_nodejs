// src/api/controllers/report.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as ReportModel from '../models/report.model';

export const getDailyReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Vui lòng cung cấp startDate và endDate.' });
        }
        const reports = await ReportModel.findDailyReports(startDate as string, endDate as string);
        res.status(200).json(reports);
    } catch (error) { next(error); }
};

export const triggerReportGeneration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reportDate } = req.body;
        if (!reportDate) {
            return res.status(400).json({ message: 'Vui lòng cung cấp reportDate (YYYY-MM-DD).' });
        }
        const newReport = await ReportModel.generateDailyReport(reportDate);
        res.status(201).json({ message: 'Tạo báo cáo thành công.', data: newReport });
    } catch (error) { next(error); }
};
import { Request, Response, NextFunction } from 'express';
import * as BranchInventoryModel from '../../models/inventory/branchInventory.model'; // Điều chỉnh đường dẫn nếu cần

// Helper function
const handleError = (res: Response, error: unknown, defaultMessage: string = 'Đã xảy ra lỗi.') => {
    console.error("Branch Inventory Controller Error:", error);
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};

// ===========================================
// == TỒN KHO CHI NHÁNH (STOCK) ==
// ===========================================

export const getBranchInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branchIdParam = req.params.branchId;
        const branchId = parseInt(branchIdParam, 10);
        if (isNaN(branchId)) return res.status(400).json({ message: `ID chi nhánh không hợp lệ: ${branchIdParam}` });

        const inventory = await BranchInventoryModel.getInventoryByBranch(branchId);
        res.status(200).json(inventory);
    } catch (error) {
        handleError(res, error, 'Lỗi khi lấy tồn kho chi nhánh.');
    }
};
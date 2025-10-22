import pool from '../../../config/db';

/**
 * Lấy tồn kho chi tiết của một chi nhánh.
 */
export const getInventoryByBranch = async (branchId: number): Promise<any[]> => { // Kiểu trả về có thể cần chi tiết hơn
    const result = await pool.query(
        `SELECT
            bi.variant_id, bi.quantity, bi.updated_at as last_updated,
            pv.name as variant_name, pv.sku, pv.image as variant_image, pv.price,
            p.name as product_name, p.id as product_id, p.images->>'thumbnail' as product_image
         FROM branch_inventories bi
         JOIN product_variants pv ON bi.variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE bi.branch_id = $1
         ORDER BY p.name ASC, pv.name ASC`,
        [branchId]
    );
     // Chuyển đổi quantity sang number
    return result.rows.map(row => ({
         ...row,
         quantity: parseInt(row.quantity, 10),
         price: row.price ? parseFloat(row.price) : null
    }));
};
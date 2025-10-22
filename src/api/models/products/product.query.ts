import pool from '../../../config/db';
import { Product } from '../../types/products/product.type';

interface FindAllOptions {
    limit: number;
    offset: number;
    search?: string;
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    isFeatured?: boolean;
    sortBy?: 'price' | 'name' | 'created_at';
    sortOrder?: 'asc' | 'desc';
}

/**
 * [NÂNG CẤP] Lấy danh sách sản phẩm với đầy đủ thông tin và các phiên bản đi kèm.
 */
export const findAllProducts = async (options: FindAllOptions): Promise<{ products: Product[], total: number }> => {
    const { limit, offset, search, categoryId, minPrice, maxPrice, isFeatured, sortBy, sortOrder } = options;
    
    const queryParams: any[] = [];
    let whereClauses = ['p.deleted_at IS NULL'];
    
    // Xây dựng các điều kiện lọc (WHERE)
    if (search) {
        whereClauses.push(`p.search_vector @@ to_tsquery('simple', $${queryParams.length + 1})`);
        queryParams.push(search.split(' ').join(' & '));
    }
    if (categoryId) {
        whereClauses.push(`p.category_id = $${queryParams.length + 1}`);
        queryParams.push(categoryId);
    }
    if (minPrice) {
        whereClauses.push(`p.price >= $${queryParams.length + 1}`);
        queryParams.push(minPrice);
    }
    if (maxPrice) {
        whereClauses.push(`p.price <= $${queryParams.length + 1}`);
        queryParams.push(maxPrice);
    }
    if (isFeatured) {
        whereClauses.push(`p.is_featured = true`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Xây dựng mệnh đề sắp xếp (ORDER BY)
    const allowedSortBy = ['price', 'name', 'created_at'];
    const safeSortBy = sortBy && allowedSortBy.includes(sortBy) ? `p."${sortBy}"` : 'p.id';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByString = `ORDER BY ${safeSortBy} ${safeSortOrder}`;

    // --- TỐI ƯU HÓA PHÂN TRANG VÀ JOIN ---
    // Bước 1: Chỉ lấy ID của các sản phẩm trên trang hiện tại. Câu query này rất nhanh.
    const idQuery = `SELECT p.id FROM products p ${whereString} ${orderByString} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const idResult = await pool.query(idQuery, [...queryParams, limit, offset]);
    const productIds = idResult.rows.map(row => row.id);

    if (productIds.length === 0) {
        return { products: [], total: 0 };
    }

    // Bước 2: Lấy toàn bộ thông tin chi tiết cho các ID đã tìm thấy.
    const productsQuery = pool.query(
        `SELECT 
            p.*, 
            c.name as category_name,
            u.name as unit_name,
            json_agg(
                json_build_object(
                    'id', pv.id,
                    'name', pv.name,
                    'sku', pv.sku,
                    'price', pv.price,
                    'stock_quantity', pv.stock_quantity,
                    'weight', pv.weight,
                    'image', pv.image
                )
            ) FILTER (WHERE pv.id IS NOT NULL) as variants
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN units u ON p.unit_id = u.id
         LEFT JOIN product_variants pv ON p.id = pv.product_id
         WHERE p.id = ANY($1::int[])
         GROUP BY p.id, c.name, u.name
         ORDER BY ${safeSortBy} ${safeSortOrder}`, // Sắp xếp lại kết quả cuối cùng
        [productIds]
    );

    // Query đếm tổng số lượng vẫn giữ nguyên và chạy song song
    const totalQuery = pool.query(`SELECT COUNT(*) FROM products p ${whereString}`, queryParams);
    
    const [productsResult, totalResult] = await Promise.all([productsQuery, totalQuery]);

    return {
        products: productsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10),
    };
};
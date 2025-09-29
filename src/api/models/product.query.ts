import pool from '../../config/db';
import { Product } from '../types/product.type';

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
 * Lấy danh sách sản phẩm với các bộ lọc, tìm kiếm và sắp xếp nâng cao.
 */
export const findAllProducts = async (options: FindAllOptions): Promise<{ products: Product[], total: number }> => {
    const { limit, offset, search, categoryId, minPrice, maxPrice, isFeatured, sortBy, sortOrder } = options;
    
    const queryParams: any[] = [];
    let whereClauses = ['p.deleted_at IS NULL'];
    
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

    const allowedSortBy = ['price', 'name', 'created_at'];
    const safeSortBy = sortBy && allowedSortBy.includes(sortBy) ? `p."${sortBy}"` : 'p.id';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByString = `ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const finalQueryParams = [...queryParams, limit, offset];
    
    const productsQuery = pool.query(
        `SELECT p.id, p.name, p.slug, p.price, p.images, p.stock_quantity, p.is_featured, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereString}
         ${orderByString}
         LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
        finalQueryParams
    );

    const totalQuery = pool.query(`SELECT COUNT(*) FROM products p ${whereString}`, queryParams);
    
    const [productsResult, totalResult] = await Promise.all([productsQuery, totalQuery]);

    return {
        products: productsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10),
    };
};
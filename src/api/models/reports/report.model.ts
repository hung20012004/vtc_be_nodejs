import pool from '../../../config/db'; // Adjust path if needed

// --- Interfaces for Options ---
interface TimeRangeOptions {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

interface BranchReportOptions extends TimeRangeOptions {
    branchId?: number;
}

interface PaginationOptions {
    limit: number;
    offset: number;
}

// --- Helper Functions ---
const getAdjustedEndDate = (endDate: string): string => {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
    return adjustedEndDate.toISOString().split('T')[0];
};

// --- Sales & Revenue Reports ---

export const getRevenueOverview = async (options: TimeRangeOptions) => {
    const { startDate } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const query = `
        SELECT
            COUNT(id)::int AS total_orders,
            COALESCE(SUM(total_amount), 0)::float AS total_revenue,
            COALESCE(AVG(total_amount), 0)::float AS average_order_value,
            COALESCE(SUM(subtotal), 0)::float AS net_sales,         -- Added Net Sales
            COALESCE(SUM(shipping_fee), 0)::float AS total_shipping, -- Added Shipping
            COALESCE(SUM(discount_amount), 0)::float AS total_discount -- Added Discount
        FROM orders
        WHERE order_date >= $1 AND order_date < $2
          AND order_status IN ('confirmed', 'processing', 'shipped', 'completed')
    `;
    const result = await pool.query(query, [startDate, endDateString]);
    return result.rows[0] || { total_orders: 0, total_revenue: 0, average_order_value: 0, net_sales: 0, total_shipping: 0, total_discount: 0 };
};

export const getRevenueByTimePeriod = async (options: TimeRangeOptions & { period: 'day' | 'week' | 'month' | 'year' }) => {
    const { startDate, period } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    let dateFormat: string;
    switch (period) {
        case 'week': dateFormat = 'YYYY-WW'; break; // ISO Week number
        case 'month': dateFormat = 'YYYY-MM'; break;
        case 'year': dateFormat = 'YYYY'; break;
        case 'day':
        default: dateFormat = 'YYYY-MM-DD'; break;
    }

    const query = `
        SELECT
            TO_CHAR(order_date, $3) AS "period",
            COALESCE(SUM(total_amount), 0)::float AS revenue,
            COUNT(id)::int as order_count
        FROM orders
        WHERE order_date >= $1 AND order_date < $2
          AND order_status IN ('confirmed', 'processing', 'shipped', 'completed')
        GROUP BY "period"
        ORDER BY "period" ASC;
    `;
    const result = await pool.query(query, [startDate, endDateString, dateFormat]);
    return result.rows;
};

export const getOrderStatusCounts = async (options: TimeRangeOptions) => {
    const { startDate } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const query = `
        SELECT
            order_status,
            COUNT(id)::int AS count
        FROM orders
        WHERE order_date >= $1 AND order_date < $2
        GROUP BY order_status
        ORDER BY order_status;
    `;
    const result = await pool.query(query, [startDate, endDateString]);
    return result.rows;
};

export const getRevenueByPaymentMethod = async (options: TimeRangeOptions) => {
    const { startDate } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const query = `
        SELECT
            COALESCE(payment_method, 'N/A') as payment_method,
            COUNT(id)::int AS order_count,
            COALESCE(SUM(total_amount), 0)::float AS total_revenue
        FROM orders
        WHERE order_date >= $1 AND order_date < $2
          AND order_status IN ('confirmed', 'processing', 'shipped', 'completed')
        GROUP BY payment_method
        ORDER BY total_revenue DESC;
    `;
    const result = await pool.query(query, [startDate, endDateString]);
    return result.rows;
};

export const getRevenueByProvince = async (options: TimeRangeOptions) => {
    const { startDate } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const query = `
        SELECT
            COALESCE(shipping_province, 'N/A') as province,
            COUNT(id)::int AS order_count,
            COALESCE(SUM(total_amount), 0)::float AS total_revenue
        FROM orders
        WHERE order_date >= $1 AND order_date < $2
          AND order_status IN ('confirmed', 'processing', 'shipped', 'completed')
        GROUP BY shipping_province
        ORDER BY total_revenue DESC;
    `;
    const result = await pool.query(query, [startDate, endDateString]);
    return result.rows;
};

// --- Product Reports ---

export const getTopSellingItems = async (options: TimeRangeOptions & { limit: number; sortBy: 'quantity' | 'revenue' }) => {
    const { startDate, limit, sortBy } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const orderByClause = sortBy === 'revenue'
        ? 'SUM(oi.quantity * oi.unit_price) DESC'
        : 'SUM(oi.quantity) DESC';

    const query = `
        SELECT
            oi.variant_id,
            oi.product_name,
            pv.sku,
            p.images->>'thumbnail' as image,
            SUM(oi.quantity)::int AS total_quantity_sold,
            SUM(oi.quantity * oi.unit_price)::float AS total_revenue_generated
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN product_variants pv ON oi.variant_id = pv.id
        LEFT JOIN products p ON pv.product_id = p.id
        WHERE o.order_date >= $1 AND o.order_date < $2
          AND o.order_status IN ('confirmed', 'processing', 'shipped', 'completed')
        GROUP BY oi.variant_id, oi.product_name, pv.sku, p.images->>'thumbnail'
        ORDER BY ${orderByClause}
        LIMIT $3;
    `;
    const result = await pool.query(query, [startDate, endDateString, limit]);
    return result.rows;
};

export const getRevenueByCategory = async (options: TimeRangeOptions) => {
    const { startDate } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const query = `
        SELECT
            c.id as category_id,
            c.name as category_name,
            SUM(oi.quantity * oi.unit_price)::float AS total_revenue_generated,
            SUM(oi.quantity)::int as total_quantity_sold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        -- Assuming product_id in order_items is reliable, otherwise join through variants
        JOIN products p ON oi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE o.order_date >= $1 AND o.order_date < $2
          AND o.order_status IN ('confirmed', 'processing', 'shipped', 'completed')
        GROUP BY c.id, c.name
        ORDER BY total_revenue_generated DESC;
    `;
    const result = await pool.query(query, [startDate, endDateString]);
    return result.rows;
};

// --- Customer Reports ---

export const getTopCustomers = async (options: TimeRangeOptions & { limit: number; sortBy: 'revenue' | 'orders' }) => {
    const { startDate, limit, sortBy } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const orderByClause = sortBy === 'revenue'
        ? 'SUM(o.total_amount) DESC'
        : 'COUNT(o.id) DESC';

    const query = `
        SELECT
            o.customer_id,
            c.name as customer_name,
            c.email as customer_email,
            c.phone as customer_phone,
            COUNT(o.id)::int AS total_orders,
            COALESCE(SUM(o.total_amount), 0)::float AS total_spent
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.order_date >= $1 AND o.order_date < $2
          AND o.order_status IN ('confirmed', 'processing', 'shipped', 'completed')
          AND o.customer_id IS NOT NULL
        GROUP BY o.customer_id, c.name, c.email, c.phone
        ORDER BY ${orderByClause}
        LIMIT $3;
    `;
    const result = await pool.query(query, [startDate, endDateString, limit]);
    return result.rows;
};

export const getNewCustomersTrend = async (options: TimeRangeOptions & { period: 'day' | 'month' | 'year' }) => {
    const { startDate, period } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    let dateFormat: string;
    switch (period) {
        case 'month': dateFormat = 'YYYY-MM'; break;
        case 'year': dateFormat = 'YYYY'; break;
        case 'day':
        default: dateFormat = 'YYYY-MM-DD'; break;
    }

    const query = `
        SELECT
            TO_CHAR(created_at, $3) AS "period",
            COUNT(id)::int AS new_customer_count
        FROM customers -- Assuming 'customers' table holds customer info
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY "period"
        ORDER BY "period" ASC;
    `;
    const result = await pool.query(query, [startDate, endDateString, dateFormat]);
    return result.rows;
};


// --- Inventory Reports ---

export const getCurrentStockLevels = async (options: { branchId?: number; lowStock?: boolean; search?: string }) => {
    const { branchId, lowStock, search } = options;
    const queryParams: any[] = [];
    let whereClauses: string[] = [];

    if (branchId !== undefined) {
        queryParams.push(branchId);
        whereClauses.push(`bi.branch_id = $${queryParams.length}`);
    }

    if (lowStock) {
        whereClauses.push(`bi.quantity <= COALESCE(p.min_stock, 0)`);
    }

    if (search) {
        queryParams.push(`%${search.toLowerCase()}%`);
        const searchIndex = queryParams.length;
        whereClauses.push(`(LOWER(p.name) LIKE $${searchIndex} OR LOWER(pv.name) LIKE $${searchIndex} OR LOWER(pv.sku) LIKE $${searchIndex})`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
        SELECT
            bi.branch_id, COALESCE(b.name, 'Kho Tổng') as branch_name,
            bi.variant_id, pv.sku, p.name as product_name, pv.name as variant_name,
            bi.quantity::int,
            p.min_stock,
            pv.price::float, p.images->>'thumbnail' as image,
            COALESCE(pv.cost_price, p.cost_price)::float as cost_price,
            bi.updated_at
        FROM branch_inventories bi
        JOIN product_variants pv ON bi.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN branches b ON bi.branch_id = b.id
        ${whereString}
        ORDER BY branch_name, p.name, pv.name;
    `;
    const result = await pool.query(query, queryParams);
    return result.rows.map(row => ({
        ...row,
        price: row.price ? parseFloat(row.price.toString()) : null,
        cost_price: row.cost_price ? parseFloat(row.cost_price.toString()) : null
    }));
};

export const getInventoryValue = async (options: { branchId?: number }) => {
     const { branchId } = options;
     const queryParams: any[] = [];
     let whereClause = '';

     if (branchId !== undefined) {
         queryParams.push(branchId);
         whereClause = `WHERE bi.branch_id = $${queryParams.length}`;
     }

     const query = `
         SELECT
             COALESCE(SUM(bi.quantity * COALESCE(pv.cost_price, p.cost_price, 0)), 0)::float AS total_inventory_value
         FROM branch_inventories bi
         JOIN product_variants pv ON bi.variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         ${whereClause};
     `;
     const result = await pool.query(query, queryParams);
     return result.rows[0] || { total_inventory_value: 0 };
 };

export const getImportHistory = async(options: BranchReportOptions & PaginationOptions) => {
    const { startDate, limit, offset, branchId } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    // Note: Import currently only goes to branch 0 in the model.
    // If imports can go to specific branches, add branchId filter here.
    const queryParams: any[] = [startDate, endDateString, limit, offset];

    const query = `
        SELECT
            ii.id, ii.import_code, ii.import_date, ii.status, ii.total_amount::float,
            s.name as supplier_name, u.name as requested_by_name
        FROM inventory_imports ii
        LEFT JOIN suppliers s ON ii.supplier_id = s.id
        LEFT JOIN users u ON ii.requested_by = u.id
        WHERE ii.import_date >= $1 AND ii.import_date < $2
        ORDER BY ii.import_date DESC
        LIMIT $3 OFFSET $4;
    `;
    const countQuery = `SELECT COUNT(*) FROM inventory_imports WHERE import_date >= $1 AND import_date < $2;`;

    const [importsResult, totalResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, [startDate, endDateString])
    ]);

    return {
        data: importsResult.rows.map(r => ({...r, total_amount: parseFloat(r.total_amount?.toString() || '0')})),
        total: parseInt(totalResult.rows[0].count, 10)
    };
};

export const getExportHistory = async(options: BranchReportOptions & PaginationOptions & { type?: number }) => {
    const { startDate, limit, offset, branchId, type } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const queryParams: any[] = [startDate, endDateString];
    let whereClauses: string[] = ['ie.export_date >= $1', 'ie.export_date < $2'];

    if (branchId !== undefined) {
        // Filter by either source OR destination branch
        queryParams.push(branchId);
        whereClauses.push(`(ie.from_branch_id = $${queryParams.length} OR ie.to_branch_id = $${queryParams.length})`);
    }
    if (type !== undefined) {
        queryParams.push(type);
        whereClauses.push(`ie.type = $${queryParams.length}`);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
        SELECT
            ie.id, ie.export_code, ie.export_date, ie.status, ie.type, ie.total_quantity::int,
            fb.name as from_branch_name, tb.name as to_branch_name, u.name as created_by_name
        FROM inventory_exports ie
        LEFT JOIN branches fb ON ie.from_branch_id = fb.id
        LEFT JOIN branches tb ON ie.to_branch_id = tb.id
        LEFT JOIN users u ON ie.created_by = u.id
        ${whereString}
        ORDER BY ie.export_date DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
    `;
    const countQuery = `SELECT COUNT(*) FROM inventory_exports ie ${whereString};`;

    queryParams.push(limit, offset);

    const [exportsResult, totalResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    return {
        data: exportsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10)
    };
};

export const getInventoryAdjustments = async (options: BranchReportOptions & PaginationOptions) => {
    const { startDate, limit, offset, branchId } = options;
    const endDateString = getAdjustedEndDate(options.endDate);
    const queryParams: any[] = [startDate, endDateString];
    let whereClauses: string[] = ['ic.check_date >= $1', 'ic.check_date < $2', `ic.status = 'completed'`]; // Only completed checks cause adjustments

    if (branchId !== undefined) {
        queryParams.push(branchId);
        whereClauses.push(`ic.branch_id = $${queryParams.length}`);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // Select adjustment details joined with check info
    const query = `
        SELECT
            ici.id as item_id, ici.inventory_check_id, ic.check_date,
            ic.branch_id, COALESCE(b.name, 'Kho Tổng') as branch_name,
            ici.variant_id, pv.sku, p.name as product_name, pv.name as variant_name,
            ici.previous_quantity::int, ici.counted_quantity::int, ici.adjustment::int
        FROM inventory_check_items ici
        JOIN inventory_checks ic ON ici.inventory_check_id = ic.id
        JOIN product_variants pv ON ici.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN branches b ON ic.branch_id = b.id
        ${whereString}
        ORDER BY ic.check_date DESC, ici.id
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
    `;
    // Count total number of *adjustment items* matching the filter
    const countQuery = `
        SELECT COUNT(ici.id)
        FROM inventory_check_items ici
        JOIN inventory_checks ic ON ici.inventory_check_id = ic.id
        ${whereString};
    `;

    queryParams.push(limit, offset);

    const [itemsResult, totalResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset
    ]);

     return {
        data: itemsResult.rows,
        total: parseInt(totalResult.rows[0].count, 10)
    };
};
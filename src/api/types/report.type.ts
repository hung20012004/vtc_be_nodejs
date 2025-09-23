// src/api/types/report.type.ts
export interface DailySalesReport {
  id: number;
  report_date: Date;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  new_customers: number;
  created_at: Date;
}
export interface IShift {
  id: number;
  branch_id: number;
  cashier_user_id: number;
  opened_at: string;
  closed_at?: string | null;
  opening_cash: number;
  closing_cash?: number | null;
  declared_cash?: number | null;
  notes?: string | null;
}

export interface IShiftSummary {
  orders_cash: number;
  orders_card: number;
  orders_deposit: number;
  orders_total: number;
  sessions_total: number;
  expected_cash: number;
  gross_total: number;
}

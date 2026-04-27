export interface IMember {
  id: number;
  branch_id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  card_code?: string | null;
  balance: number;
  is_active: boolean;
  notes?: string | null;
  deposits?: IMemberDeposit[];
}

export interface IMemberDeposit {
  id: number;
  member_id: number;
  cashier_user_id?: number | null;
  kind: "topup" | "spend" | "adjust";
  amount: number;
  balance_after: number;
  reference?: string | null;
  created_at: string;
}

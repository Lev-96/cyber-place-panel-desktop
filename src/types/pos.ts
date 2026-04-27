export interface IProduct {
  id: number;
  branch_id: number;
  name: string;
  category?: string | null;
  price: number;
  is_active: boolean;
}

export interface IOrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface IOrder {
  id: number;
  branch_id: number;
  cashier_shift_id?: number | null;
  cashier_user_id?: number | null;
  member_id?: number | null;
  subtotal: number;
  total: number;
  payment_method: "cash" | "card" | "deposit";
  status: "paid" | "voided";
  created_at: string;
  items?: IOrderItem[];
}

export interface CartLine {
  product: IProduct;
  quantity: number;
}

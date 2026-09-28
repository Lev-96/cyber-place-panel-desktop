import {
  apiCreateServiceExpense,
  apiDeleteServiceExpense,
  apiMarkServiceExpensePaid,
  apiServiceExpenseReminders,
  apiServiceExpenses,
  apiUpdateServiceExpense,
  IServiceExpense,
  ServiceExpenseBody,
} from "@/api/expenses";
import { withToast } from "@/ui/notify";

export class ExpenseRepository {
  async list(): Promise<IServiceExpense[]> {
    const res = await apiServiceExpenses();
    return res.data;
  }
  async reminders(withinDays = 3): Promise<IServiceExpense[]> {
    const res = await apiServiceExpenseReminders(withinDays);
    return res.data;
  }
  async create(body: ServiceExpenseBody): Promise<IServiceExpense> {
    return withToast("expense", "created", () => apiCreateServiceExpense(body).then((r) => r.data));
  }
  async update(id: number, body: Partial<ServiceExpenseBody>): Promise<IServiceExpense> {
    return withToast("expense", "updated", () => apiUpdateServiceExpense(id, body).then((r) => r.data));
  }
  async markPaid(id: number): Promise<IServiceExpense> {
    const res = await apiMarkServiceExpensePaid(id);
    return res.data;
  }
  async remove(id: number): Promise<void> {
    await withToast("expense", "deleted", () => apiDeleteServiceExpense(id));
  }
}

export const expenseRepository = new ExpenseRepository();

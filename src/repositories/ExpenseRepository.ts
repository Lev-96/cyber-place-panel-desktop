import {
  apiCreateServiceExpense,
  apiDeleteServiceExpense,
  apiServiceExpenseReminders,
  apiServiceExpenses,
  apiUpdateServiceExpense,
  IServiceExpense,
  ServiceExpenseBody,
} from "@/api/expenses";

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
    const res = await apiCreateServiceExpense(body);
    return res.data;
  }
  async update(id: number, body: Partial<ServiceExpenseBody>): Promise<IServiceExpense> {
    const res = await apiUpdateServiceExpense(id, body);
    return res.data;
  }
  async remove(id: number): Promise<void> {
    await apiDeleteServiceExpense(id);
  }
}

export const expenseRepository = new ExpenseRepository();

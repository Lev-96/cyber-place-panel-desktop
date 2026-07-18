import {
  apiCreateCompany, apiDeleteCompany, apiGetCompanies, apiGetCompanyById, apiUpdateCompany,
  CreateCompanyBody, GetCompaniesParams, UpdateCompanyBody,
} from "@/api/companies";
import { Company } from "@/domain/Company";
import { withToast } from "@/ui/notify";

const ALL = 500;

export class CompanyRepository {
  async list(params: GetCompaniesParams = {}): Promise<Company[]> {
    const res = await apiGetCompanies({ per_page: ALL, ...params });
    return res.data.map((c) => new Company(c));
  }
  async byId(id: number): Promise<Company> {
    const res = await apiGetCompanyById(id);
    return new Company(res.companies);
  }
  async create(b: CreateCompanyBody): Promise<Company> {
    return withToast("company", "created", async () => {
      const r = await apiCreateCompany(b);
      if (r.companies) return new Company(r.companies);
      // Some Laravel endpoints only return `{ message }` on store/update — re-fetch.
      return this.refetchByEmail(b.email);
    });
  }
  /**
   * Backend `PUT /company/{id}` returns only `{ message }` (no entity), so we
   * re-fetch the company by id after a successful update to keep callers happy.
   */
  async update(id: number, b: UpdateCompanyBody): Promise<Company> {
    return withToast("company", "updated", async () => {
      const r = await apiUpdateCompany(id, b);
      if (r.companies) return new Company(r.companies);
      return this.byId(id);
    });
  }
  async remove(id: number): Promise<void> { await withToast("company", "deleted", () => apiDeleteCompany(id)); }

  private async refetchByEmail(email: string): Promise<Company> {
    const res = await apiGetCompanies({ per_page: ALL });
    const found = res.data.find((c) => c.email === email);
    if (!found) throw new Error("Company saved but could not be re-fetched");
    return new Company(found);
  }
}

export const companyRepository = new CompanyRepository();

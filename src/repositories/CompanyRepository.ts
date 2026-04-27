import { apiGetCompanies, apiGetCompanyById, GetCompaniesParams } from "@/api/companies";
import { Company } from "@/domain/Company";

export class CompanyRepository {
  async list(params: GetCompaniesParams = {}): Promise<Company[]> {
    const res = await apiGetCompanies({ per_page: 50, ...params });
    return res.data.map((c) => new Company(c));
  }
  async byId(id: number): Promise<Company> {
    const res = await apiGetCompanyById(id);
    return new Company(res.companies);
  }
}

export const companyRepository = new CompanyRepository();

import { ICompanyApi } from "@/types/api";

export class Company {
  readonly id: number;
  readonly name: string;
  readonly raw: ICompanyApi;

  constructor(raw: ICompanyApi) {
    this.raw = raw;
    this.id = raw.id;
    this.name = raw.name;
  }
}

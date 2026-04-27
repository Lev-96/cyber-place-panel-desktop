import { IBranchService } from "@/types/api";

export type Lang = "en" | "ru" | "am";

export class Service {
  readonly id: number;
  readonly logoPath?: string;
  private readonly names: Record<Lang, string>;
  readonly raw: IBranchService;

  constructor(raw: IBranchService) {
    this.raw = raw;
    this.id = raw.id;
    this.logoPath = raw.service_logo_path;
    this.names = { en: raw.name_en, ru: raw.name_ru, am: raw.name_am };
  }

  name(lang: Lang = "en"): string {
    return this.names[lang] || this.names.en;
  }
}

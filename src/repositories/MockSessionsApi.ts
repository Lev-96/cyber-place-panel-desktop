import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";
import { StartSessionBody } from "@/api/sessions";

interface State {
  sessions: ISessionApi[];
  pcs: IPcApi[];
  packages: ITimePackage[];
  nextId: number;
}

const STORAGE_KEY = `${AppConfig.storageKeys.commissionByCompany}.mock.sessions`;

const defaultPackages: ITimePackage[] = [
  { id: 1, name: "1 hour",  duration_minutes: 60,  price: 500 },
  { id: 2, name: "3 hours", duration_minutes: 180, price: 1300 },
  { id: 3, name: "5 hours", duration_minutes: 300, price: 2000 },
  { id: 4, name: "Night (8h)", duration_minutes: 480, price: 2800 },
];

const defaultPcs = (branchId: number): IPcApi[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: branchId * 100 + i + 1,
    branch_id: branchId,
    label: `PC #${i + 1}`,
    status: "offline",
  }));

class MockSessionsApi {
  private state: State | null = null;

  private async load(): Promise<State> {
    if (this.state) return this.state;
    const stored = await keyValueStore.get<State>(STORAGE_KEY);
    this.state = stored ?? { sessions: [], pcs: [], packages: defaultPackages, nextId: 1 };
    return this.state;
  }

  private async save(): Promise<void> {
    if (this.state) await keyValueStore.set(STORAGE_KEY, this.state);
  }

  async listActive(branchId: number): Promise<ISessionApi[]> {
    const s = await this.load();
    return s.sessions.filter((x) => x.branch_id === branchId && x.status === "active" && new Date(x.ends_at) > new Date());
  }

  async listPackages(): Promise<ITimePackage[]> {
    const s = await this.load();
    return s.packages;
  }

  async listPcs(branchId: number): Promise<IPcApi[]> {
    const s = await this.load();
    if (!s.pcs.some((p) => p.branch_id === branchId)) {
      s.pcs.push(...defaultPcs(branchId));
      await this.save();
    }
    const active = s.sessions.filter((x) => x.branch_id === branchId && x.status === "active");
    return s.pcs
      .filter((p) => p.branch_id === branchId)
      .map((p) => {
        const sess = active.find((a) => a.pc_id === p.id);
        return sess ? { ...p, status: "in_session", current_session_id: sess.id } : p;
      });
  }

  async start(body: StartSessionBody): Promise<ISessionApi> {
    const s = await this.load();
    const pkg = s.packages.find((p) => p.id === body.package_id);
    if (!pkg) throw new Error("Unknown package");
    const now = new Date();
    const ends = new Date(now.getTime() + pkg.duration_minutes * 60_000);
    const session: ISessionApi = {
      id: s.nextId++,
      branch_id: body.branch_id,
      pc_id: body.pc_id,
      pc_label: s.pcs.find((p) => p.id === body.pc_id)?.label ?? `PC #${body.pc_id}`,
      user_display_name: body.user_display_name,
      package_id: pkg.id,
      package_name: pkg.name,
      started_at: now.toISOString(),
      ends_at: ends.toISOString(),
      status: "active",
      total_paid: pkg.price,
    };
    s.sessions.push(session);
    await this.save();
    return session;
  }

  async stop(id: number): Promise<ISessionApi> {
    const s = await this.load();
    const session = s.sessions.find((x) => x.id === id);
    if (!session) throw new Error("Session not found");
    session.status = "stopped";
    session.ends_at = new Date().toISOString();
    await this.save();
    return session;
  }

  async extend(id: number, packageId: number): Promise<ISessionApi> {
    const s = await this.load();
    const session = s.sessions.find((x) => x.id === id);
    if (!session) throw new Error("Session not found");
    const pkg = s.packages.find((p) => p.id === packageId);
    if (!pkg) throw new Error("Unknown package");
    const newEnd = new Date(new Date(session.ends_at).getTime() + pkg.duration_minutes * 60_000);
    session.ends_at = newEnd.toISOString();
    session.total_paid += pkg.price;
    await this.save();
    return session;
  }
}

export const mockSessionsApi = new MockSessionsApi();

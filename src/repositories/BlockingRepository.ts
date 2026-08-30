import { apiBlock, apiUnblock, BlockableKind, IBlockState } from "@/api/blocking";
import { apiCache } from "@/api/client";
import { withToast } from "@/ui/notify";

/**
 * Blocks and unblocks companies and branches.
 *
 * Behind a repository like every other domain, so screens never touch `api/`
 * directly and both scopes go through one object — a screen only picks the
 * `kind`.
 */
export class BlockingRepository {
  async block(kind: BlockableKind, id: number): Promise<IBlockState> {
    return this.run(kind, "blocked", () => apiBlock(kind, id));
  }

  async unblock(kind: BlockableKind, id: number): Promise<IBlockState> {
    return this.run(kind, "unblocked", () => apiUnblock(kind, id));
  }

  private async run(
    kind: BlockableKind,
    action: "blocked" | "unblocked",
    call: () => Promise<{ data: IBlockState }>,
  ): Promise<IBlockState> {
    return withToast(kind, action, async () => {
      const res = await call();
      this.dropStaleReads();
      return res.data;
    });
  }

  /**
   * A block changes what the branch lists contain, but the request that
   * applied it went to `/admin/...` — a path the client cache's mutation
   * fan-out knows nothing about, so nothing would be invalidated and the
   * panel's own branch list could keep showing the pre-block picture for the
   * length of its TTL. Named explicitly here rather than wired into the
   * fan-out table: this is the one admin path that changes those payloads,
   * and stating it where it happens is easier to keep true.
   */
  private dropStaleReads(): void {
    apiCache.invalidatePrefix("/branches");
    apiCache.invalidatePrefix("/places");
  }
}

export const blockingRepository = new BlockingRepository();

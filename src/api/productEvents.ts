import { request } from "./client";
import type { PaginatedList } from "@/types/api";
import type { IProductEvent, IProductEventActorOption, ProductEventFilters } from "@/types/productEvents";

/**
 * The product audit trail (2026-11-09). Admin and owner only (backend
 * `products.history`, StaffBranchScope applied): an owner reads the branches
 * of their companies, never another's. Paged on the server, `per_page` ≤ 100.
 */
export const apiListProductEvents = (filters: ProductEventFilters) =>
  request<PaginatedList<IProductEvent>>("/product-events", { params: { ...filters } });

/**
 * Who can be picked in the employee filter; the branch narrows it when given.
 * Accepted as a bare list or wrapped in `data` (both Laravel idioms are in use).
 */
export const apiProductEventActors = (branchId?: number) =>
  request<IProductEventActorOption[] | { data: IProductEventActorOption[] }>(
    "/product-events/actors",
    branchId ? { params: { branch_id: branchId } } : {},
  );

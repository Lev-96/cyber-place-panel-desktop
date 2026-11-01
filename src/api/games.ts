import { PaginatedList } from "@/types/api";
import { request } from "./client";

// NOTE: `platform` is a dynamic string now (known pc/ps4/ps5 OR a custom
// branch slug like "table-tennis"), not the closed PlatformType union.
export interface IGameApi {
  id: number;
  name: string;
  platform: string;
  /** Cover image path on the backend's public disk; null/absent = no cover. */
  game_logo_path?: string | null;
  created_at?: string;
}

export interface CreateGameBody {
  name: string;
  platform: string;
  /** Optional: scope the game to a branch via the game_branches pivot. */
  branch_id?: number;
  /**
   * The operator chose the game the server reported as already existing
   * (422 `game_exists`): link that shared row to `branch_id` instead of
   * creating a duplicate. Omitted on a normal create.
   */
  use_existing?: boolean;
  /**
   * The cover image. Optional for the server (older desktops send none); the
   * form requires either a file or the explicit "no cover" switch. On
   * `use_existing` it only fills a game that has no cover yet.
   */
  game_logo_path?: File;
}

/** Admin edit of a shared catalogue row. */
export interface UpdateGameBody {
  name?: string;
  /** A new cover replaces the current one. */
  game_logo_path?: File;
  /** Clear the current cover. */
  remove_cover?: boolean;
}

/**
 * Multipart body for a write that carries a file. Booleans go as "1"/"0" —
 * Laravel's `boolean` rule refuses the strings "true"/"false" — and
 * undefined/null fields are left out.
 */
const buildGameForm = (body: object): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (v instanceof File) fd.append(k, v);
    else if (typeof v === "boolean") fd.append(k, v ? "1" : "0");
    else fd.append(k, String(v));
  }
  return fd;
};

export const apiListGames = (params: { platform?: string; branch_id?: number; per_page?: number; page?: number } = {}) =>
  request<PaginatedList<IGameApi>>("/games", { params });

/**
 * Write responses are NOT uniformly shaped by the backend: `store` returns the
 * created row wrapped by `Games\StoreResource` (`$wrap = 'games'`), while
 * `update` answers with a bare `{message}`. Both keys are optional here so a
 * caller can read the row when there is one and never assumes it exists —
 * `GameRepository` normalises this to `IGameApi | null`.
 */
export interface GameWriteResponse {
  games?: IGameApi;
  game?: IGameApi;
  message?: string;
  /** True when `use_existing` linked an existing row instead of creating one. */
  existing?: boolean;
}

/** JSON as before; multipart only when a cover file rides along. */
export const apiCreateGame = (body: CreateGameBody) =>
  request<GameWriteResponse>("/games", {
    method: "POST",
    body: body.game_logo_path ? buildGameForm(body) : body,
  });

/**
 * A rename alone stays the JSON `PUT` it always was. A new cover has to be
 * multipart, which PHP does not parse on a PUT: it goes as `POST` spoofed with
 * `?_method=PUT`, the way branch and company logos are sent.
 */
export const apiUpdateGame = (id: number, body: UpdateGameBody) =>
  body.game_logo_path
    ? request<GameWriteResponse>(`/games/${id}?_method=PUT`, { method: "POST", body: buildGameForm(body) })
    : request<GameWriteResponse>(`/games/${id}`, { method: "PUT", body });

export const apiDeleteGame = (id: number) =>
  request<{ message: string }>(`/games/${id}`, { method: "DELETE" });

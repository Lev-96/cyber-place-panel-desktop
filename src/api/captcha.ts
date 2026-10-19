import { request } from "./client";

/** Who the mosaic is for: the server ties the pass to it. */
export type CaptchaClient = "desktop" | "owner_web";

/** A shuffled 3×3 picture. Nothing in it says where the tiles belong. */
export interface ICaptchaChallenge {
  id: string;
  /** The shuffled picture, a JPEG data URL; tile k is the k-th square, row by row. */
  image: string;
  grid: number;
  size: number;
}

/**
 * A new picture. `replaces` names the one on screen, so the server forgets it
 * and it cannot be answered later.
 */
export const apiCaptchaChallenge = (client: CaptchaClient, replaces?: string) =>
  request<ICaptchaChallenge>(
    `/auth/captcha?client=${client}${replaces ? `&replaces=${encodeURIComponent(replaces)}` : ""}`,
    { noCache: true },
  );

/**
 * The one try at a picture: `order[i]` is the tile now at position i. A pass
 * when the picture is whole; a 422 `captcha_failed` otherwise, and the
 * picture is spent either way.
 */
export const apiCaptchaVerify = (client: CaptchaClient, id: string, order: number[]) =>
  request<{ captcha_token: string }>(`/auth/captcha?client=${client}`, {
    method: "POST",
    body: { id, order },
    noCache: true,
  });

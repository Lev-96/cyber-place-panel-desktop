import { beforeEach, expect, test, vi } from "vitest";

const sent = vi.hoisted(() => ({ bodies: [] as unknown[] }));
vi.mock("./client", () => ({
  request: async (_path: string, opts: { body?: unknown } = {}) => {
    sent.bodies.push(opts.body);
    return { login: { id: 1, name: "A", email: "a@b.c", role: "manager" }, token: "t" };
  },
}));

import { loginChallenge } from "@/auth/loginChallenge";
import { apiLogin } from "./auth";

beforeEach(() => { sent.bodies = []; loginChallenge.take(); });

test("a solved mosaic travels with the next desktop sign-in, once (2026-10-07)", async () => {
  loginChallenge.set("pass-1");
  await apiLogin("a@b.c", "pw");
  await apiLogin("a@b.c", "pw");

  expect(sent.bodies).toEqual([
    { email: "a@b.c", password: "pw", captcha_token: "pass-1" },
    { email: "a@b.c", password: "pw" },
  ]);
});

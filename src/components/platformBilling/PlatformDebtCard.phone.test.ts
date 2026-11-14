import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The platform bill on a phone (2026-11-09, owner web and the Telegram Mini
 * App, 360–430px): a compact card and a full-screen «Details» drawer whose
 * three facts are rows. CSS only, and only inside max-width queries, so the
 * desktop look (≥ 1100px) is untouched. Measured in Chromium at 360/375/430
 * and pixel-compared at 1280/1440/1920 (see CLAUDE.md); this keeps the rules.
 */
const css = readFileSync(path.resolve(__dirname, "../../styles/global.css"), "utf8");

/** The body of the `@media (<query>)` block that mentions `marker`. */
const mediaBlock = (query: string, marker: string): string => {
  const head = `@media (${query}) {`;
  for (let at = css.indexOf(head); at !== -1; at = css.indexOf(head, at + 1)) {
    let depth = 0;
    for (let i = at + head.length - 1; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        const body = css.slice(at + head.length, i);
        if (body.includes(marker)) return body;
        break;
      }
    }
  }
  throw new Error(`no @media (${query}) block with ${marker}`);
};

/** The declarations of the first top-level rule with exactly this selector. */
const rule = (selector: string): string => {
  const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule ${selector}`);
  return m[1];
};

describe("the debt card on a phone", () => {
  const phone = mediaBlock("max-width: 640px", ".platform-debt--wide");

  test("is tighter: smaller padding, title, amount and sentence", () => {
    expect(phone).toMatch(/\.platform-debt--wide \{\s*gap: var\(--space-3\);\s*padding: var\(--space-3\) var\(--space-4\);/);
    expect(phone).toMatch(/\.platform-debt--wide \.platform-debt__title \{[^}]*font-size: var\(--fs-body\);/);
    expect(phone).toMatch(/\.platform-debt--wide \.platform-debt__total-value \{\s*font-size: clamp\(22px, 7vw, 28px\);/);
    expect(phone).toMatch(/\.platform-debt--wide \.platform-debt__say \{\s*font-size: var\(--fs-body\);/);
  });

  test("lays the facts out two to a row, the odd last one (access) across the card", () => {
    expect(phone).toMatch(/\.platform-debt__facts \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(phone).toMatch(/\.platform-debt__fact:last-child:nth-child\(odd\) \{\s*grid-column: 1 \/ -1;\s*flex-direction: row;/);
  });

  test("puts «Details» across the whole card", () => {
    expect(phone).toMatch(/\.platform-debt--wide \.platform-debt__more \{\s*justify-self: stretch;\s*width: 100%;/);
  });

  test("leaves the desktop card as it was", () => {
    const wide = rule(".platform-debt--wide");
    expect(wide).toContain("grid-template-columns: minmax(240px, 1.2fr) minmax(0, 2fr) auto;");
    expect(wide).toContain("padding: var(--space-6);");
    expect(wide).toContain("border-left-width: 6px;");
    expect(rule(".platform-debt__facts")).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
  });
});

describe("the details drawer on a phone", () => {
  const phone = mediaBlock("max-width: 480px", ".billing-glance");

  test("takes the whole screen", () => {
    expect(phone).toMatch(/\.cp-drawer__panel \{\s*width: 100%;\s*border-left: 0;/);
  });

  test("shows the three facts as rows, label left and figure right, so no amount breaks mid-number", () => {
    expect(phone).toMatch(/\.billing-glance__facts \{\s*grid-template-columns: 1fr;/);
    expect(phone).toMatch(/\.billing-glance__facts div \{\s*flex-direction: row;[^}]*justify-content: space-between;/);
    expect(phone).toMatch(/\.billing-glance__facts dd \{\s*text-align: right;/);
  });

  test("leaves the desktop drawer as it was", () => {
    expect(rule(".cp-drawer__panel")).toContain("width: min(460px, 100vw);");
    expect(rule(".billing-glance__facts")).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
  });
});

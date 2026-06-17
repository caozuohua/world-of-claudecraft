// Phase 6: the t() miss / pending policy and its release-vs-non-release split.
//
// Locked decision #4: on a miss, t() THROWS for an untracked key in dev/test,
// renders English for a registry-`pending` key on a non-release build only, and
// HARD-FAILS for a pending key on a release build. Release is detected via
// I18N_RELEASE=1 (tests/build) or import.meta.env.PROD (the real Vite build).
//
// These are permanent regression guards with real teeth: the untracked cases run
// against the real table; the pending cases inject a synthetic pending key through
// the generated module so the ACTUAL t() pending branch is exercised in both
// release and non-release modes (the real `pending` set is empty while overlays
// stay dense, so it cannot be triggered from committed data alone).

import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en } from "../src/ui/i18n.en";
import { pending as realPending } from "../src/ui/i18n.resolved.generated";
import { t, setLanguage, type TranslationKey } from "../src/ui/i18n";

// Call t() with an arbitrary string (bypassing the TranslationKey compile-time
// type) so we can exercise the runtime untracked path.
const tRaw = t as unknown as (key: string, values?: Record<string, string | number>) => string;

afterEach(() => {
  delete process.env.I18N_RELEASE;
  setLanguage("en");
});

describe("t(): untracked key (absent from the table and from en)", () => {
  it("throws in dev/test (no release flag)", () => {
    delete process.env.I18N_RELEASE;
    setLanguage("en");
    expect(() => tRaw("totally.bogus.untracked.key")).toThrow(/untracked key/);
    // A real key still resolves normally, so the guard is not blanket-throwing.
    expect(tRaw("nav.home")).toBe("Home");
  });

  it("degrades to the raw key on a release build (never crashes a player's client)", () => {
    process.env.I18N_RELEASE = "1";
    setLanguage("en");
    expect(tRaw("totally.bogus.untracked.key")).toBe("totally.bogus.untracked.key");
    // A real key still resolves on release.
    expect(tRaw("nav.home")).toBe("Home");
  });
});

describe("t(): pending key (untranslated; the dense table English-fills it)", () => {
  const GEN = "../src/ui/i18n.resolved.generated";

  // Re-import i18n fresh with a generated module whose `pending` lists a synthetic
  // top-level key (so injecting it into the nested table is a single shallow copy).
  async function loadWithPending() {
    vi.resetModules();
    vi.doMock(GEN, async () => {
      const actual = await vi.importActual<typeof import("../src/ui/i18n.resolved.generated")>(GEN);
      const SAMPLE = "__samplePendingKey";
      const FILL = "English fill {name}";
      return {
        ...actual,
        translations: {
          ...actual.translations,
          es: { ...actual.translations.es, [SAMPLE]: FILL },
          en: { ...actual.translations.en, [SAMPLE]: FILL },
        },
        pending: { ...actual.pending, es: ["__samplePendingKey"] },
      };
    });
    return await import("../src/ui/i18n");
  }

  afterEach(() => {
    vi.doUnmock(GEN);
    vi.resetModules();
  });

  it("renders the English fill on a non-release build", async () => {
    delete process.env.I18N_RELEASE;
    const mod = await loadWithPending();
    mod.setLanguage("es");
    const tm = mod.t as unknown as (k: string, v?: Record<string, string | number>) => string;
    expect(tm("__samplePendingKey", { name: "Aki" })).toBe("English fill Aki");
  });

  it("hard-fails on a release build (English must never ship to a translated player)", async () => {
    process.env.I18N_RELEASE = "1";
    const mod = await loadWithPending();
    mod.setLanguage("es");
    const tm = mod.t as unknown as (k: string) => string;
    expect(() => tm("__samplePendingKey")).toThrow(/pending/);
  });
});

describe("t(): the committed pending set is empty while overlays stay dense", () => {
  it("every locale's generated pending list is empty", () => {
    for (const [lang, keys] of Object.entries(realPending)) {
      expect(keys, `${lang} has unexpected pending keys`).toEqual([]);
    }
  });
});

// The throw-on-untracked path is reachable in production only through
// translatePage() in src/main.ts, which feeds index.html `data-i18n*` attribute
// values straight into t(). If any of those keys were not a real `en` leaf, the
// live client would throw mid-render (dev) or show a raw key (release). Pin every
// such key to the en leaf set so a typo'd attribute fails CI here instead.
describe("index.html data-i18n keys are all real en leaves", () => {
  function flatten(node: unknown, prefix = "", out = new Set<string>()): Set<string> {
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const value = (node as Record<string, unknown>)[key];
      const p = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, p, out);
      else out.add(p);
    }
    return out;
  }
  const enLeaves = flatten(en);

  it("resolve via t() (no untracked attribute key)", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    const keys = new Set<string>();
    const re = /\bdata-i18n(?:-aria|-placeholder|-title|-alt|-content)?="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) keys.add(m[1]);
    expect(keys.size, "sanity: index.html should carry many data-i18n keys").toBeGreaterThan(50);
    const notLeaf = [...keys].filter((k) => !enLeaves.has(k)).sort();
    expect(notLeaf, "index.html data-i18n keys not present in en (would throw/leak in the client)").toEqual([]);
  });
});

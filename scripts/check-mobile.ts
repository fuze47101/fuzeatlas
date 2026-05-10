/**
 * Mobile-layout anti-pattern scanner.
 *
 * Walks src/app/**.tsx and src/components/**.tsx, flags layouts
 * likely to break at the iPhone 13 viewport (390×844). Reports each
 * hit with file:line:reason. Exit non-zero on any violations so it
 * can be wired into CI later.
 *
 * Patterns flagged:
 *   - `<table>` element NOT wrapped in a parent with overflow-x-auto
 *     (or overflow-auto). Wrapper detection is fuzzy — checks the
 *     enclosing 6 lines for the wrapper class.
 *   - `min-w-[NNN]` where NNN > 400 (will horizontal-scroll on a
 *     390px viewport without an overflow wrapper).
 *   - `grid-cols-{N}` with N >= 5 used WITHOUT a smaller-screen
 *     breakpoint earlier in the className (e.g. `grid-cols-7` is
 *     fine if preceded by `grid-cols-2 sm:grid-cols-7`, but
 *     unprefixed `grid-cols-7` slams the mobile viewport).
 *
 * Usage:
 *   npx tsx scripts/check-mobile.ts
 *   npx tsx scripts/check-mobile.ts --staged
 */

import { execSync } from "node:child_process";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

const PATH_DENYLIST = [
  "node_modules",
  ".next",
  ".git",
  "scripts/check-mobile.ts",
  // Print pages are intentionally desktop-shaped.
  "/print/",
  // Public landing pages have their own visual constraints.
  "src/app/factory-invitation/",
  "src/app/docs/",
];

const FILE_EXTS = new Set([".tsx"]);

interface Violation {
  file: string;
  line: number;
  reason: string;
  excerpt: string;
}

function isDenylisted(rel: string): boolean {
  return PATH_DENYLIST.some((p) => rel.startsWith(p) || rel.includes(p));
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = full.startsWith(ROOT + "/") ? full.slice(ROOT.length + 1) : full;
    if (isDenylisted(rel)) continue;
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (stat.isFile()) {
      yield full;
    }
  }
}

function scanFile(absPath: string): Violation[] {
  const rel = absPath.startsWith(ROOT + "/") ? absPath.slice(ROOT.length + 1) : absPath;
  const ext = extname(absPath);
  if (!FILE_EXTS.has(ext)) return [];
  let body: string;
  try {
    body = readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const lines = body.split("\n");
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // <table> without overflow wrapper in the previous ~6 lines.
    if (/<table[\s>]/.test(line)) {
      const start = Math.max(0, i - 6);
      const window = lines.slice(start, i).join(" ");
      if (!/overflow-(x-auto|auto|x-scroll|scroll)/.test(window)) {
        violations.push({
          file: rel,
          line: i + 1,
          reason: "<table> not wrapped in overflow-x-auto / overflow-auto",
          excerpt: line.trim(),
        });
      }
    }

    // min-w-[NNN] with NNN > 400.
    const minw = line.matchAll(/min-w-\[(\d+)px\]/g);
    for (const m of minw) {
      const n = parseInt(m[1], 10);
      if (n > 400) {
        violations.push({
          file: rel,
          line: i + 1,
          reason: `min-w-[${n}px] exceeds 400px (iPhone viewport is 390px)`,
          excerpt: line.trim(),
        });
      }
    }

    // grid-cols-{>=5} without a smaller-screen breakpoint.
    const grid = line.match(/grid-cols-(\d+)/);
    if (grid) {
      const n = parseInt(grid[1], 10);
      // Skip if the className also has a smaller breakpoint variant.
      // Patterns like "grid-cols-2 sm:grid-cols-7" are fine.
      const smaller = /(grid-cols-[1-4])(?!\d)/.test(line);
      const hasResponsive = /(sm:|md:|lg:|xl:)grid-cols-/.test(line);
      if (n >= 5 && !smaller && !hasResponsive) {
        violations.push({
          file: rel,
          line: i + 1,
          reason: `grid-cols-${n} with no smaller-screen variant — will be cramped on mobile`,
          excerpt: line.trim(),
        });
      }
    }
  }
  return violations;
}

function getStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      cwd: ROOT,
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const argv = process.argv.slice(2);
  const stagedMode = argv.includes("--staged");
  const explicit = argv.filter((a) => !a.startsWith("--"));

  let files: string[];
  if (stagedMode) {
    files = getStagedFiles().map((f) => join(ROOT, f));
  } else if (explicit.length > 0) {
    files = explicit.map((f) => (f.startsWith("/") ? f : join(ROOT, f)));
  } else {
    files = [...walk(join(ROOT, "src", "app")), ...walk(join(ROOT, "src", "components"))];
  }

  const all: Violation[] = [];
  for (const f of files) {
    const rel = f.startsWith(ROOT + "/") ? f.slice(ROOT.length + 1) : f;
    if (isDenylisted(rel)) continue;
    all.push(...scanFile(f));
  }

  if (all.length === 0) {
    console.log("✓ Mobile-layout scan: no anti-patterns found.");
    process.exit(0);
  }

  console.error(`✗ Mobile-layout scan: ${all.length} potential issue(s) found.\n`);
  for (const v of all) {
    console.error(`  ${v.file}:${v.line}  ${v.reason}`);
    console.error(`    ${v.excerpt}`);
  }
  console.error(
    "\nFix by adding `overflow-x-auto` wrappers, providing smaller-screen grid variants " +
      "(e.g. `grid-cols-2 sm:grid-cols-7`), or shrinking min-widths under 400px.",
  );
  process.exit(1);
}

main();

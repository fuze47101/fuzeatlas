/**
 * Brand-voice scanner.
 *
 * Walks the source tree for forbidden marketing/customer-facing terms
 * that violate the FUZE brand voice rules in CLAUDE.md ("Critical
 * Brand Language"):
 *
 *   - silver / silver-ion / nano-silver / silver nanoparticle
 *   - nano / nanoparticle / nano silver
 *   - water-based silver
 *
 * Customer-facing copy MUST use FUZE / metamaterial. Compliance docs
 * (CIL, ARSL, SDS) and explicit competitor-attribution context
 * (talking ABOUT competitors) are exempt.
 *
 * Usage:
 *   npx tsx scripts/check-brand-voice.ts            # scan everything
 *   npx tsx scripts/check-brand-voice.ts --staged   # scan staged files only
 *   npx tsx scripts/check-brand-voice.ts a.tsx b.ts # scan specific files
 *
 * Exits non-zero on any violation. Print only the offending lines so
 * the auto-triage workflow can ingest the output verbatim if needed.
 */

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { readdirSync } from "node:fs";

const ROOT = process.cwd();

// Files / directories we never scan. The CLAUDE.md table itself uses
// the forbidden words to *describe* the rule — that's expected.
const PATH_DENYLIST = [
  "node_modules",
  ".next",
  ".git",
  "scripts/check-brand-voice.ts",
  "CLAUDE.md",
  "memory/",
  "docs/AUTONOMOUS_BUILD_LOG.md",
  "docs/ROADMAP_v2.md",
  "docs/UX_AUDIT_REQUEST.md",
  "docs/AUTOMATION.md",
  // Compliance docs may reference chemical names per rule
  "docs/compliance/",
  "prisma/schema.prisma",
  // Education page is the science attribution context
  "src/app/education/page.tsx",
  "src/app/education/[segment]/page.tsx",
  "src/lib/education-segments.ts",
  // Knowledge base — explicit attribution context
  "src/lib/fuze-knowledge.ts",
  // Competitor catalog — entire file is competitor attribution
  "src/lib/competitors.ts",
  // Sustainability comparison libs — competitor manufacturing analysis
  "src/lib/sustainability.ts",
  "src/lib/pdf-sustainability-competitive.ts",
  "src/lib/pdf-sustainability.ts",
  // History: existing competitive intelligence + comparison surfaces
  "src/app/admin/competitive-intel",
  "src/app/admin/competitor-watch",
  "src/app/admin/competitor-database",
  // Tests / fixtures
  "src/__tests__/",
  // PDFs / docx / images / lockfiles
];

const FILE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);

interface Pattern {
  rx: RegExp;
  label: string;
}

const PATTERNS: Pattern[] = [
  { rx: /\bsilver[-\s]?ion(s)?\b/i, label: "silver-ion" },
  { rx: /\bnano[-\s]?silver\b/i, label: "nano-silver" },
  { rx: /\bsilver[-\s]?nanoparticle(s)?\b/i, label: "silver nanoparticle" },
  { rx: /\bnanoparticle(s)?\b/i, label: "nanoparticle" },
  { rx: /\bnanosilver\b/i, label: "nanosilver" },
  { rx: /\bwater[-\s]?based silver\b/i, label: "water-based silver" },
];

interface Violation {
  file: string;
  line: number;
  col: number;
  text: string;
  pattern: string;
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
  const violations: Violation[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : "";
    // Skip explicit competitor attribution / negation contexts.
    if (
      /competitor|competit|silvadur|polygiene|noble biometal|microban|ultra[-\s]?fresh|sciessent|sanitized|aegis|silver chloride|agcl|attribution|brand[-\s]?voice/i.test(
        line,
      )
    ) {
      continue;
    }
    // Skip lines explicitly NEGATING (e.g. "is not a nanoparticle", "not silver").
    // Look at this line and the previous line — multi-line sentences in
    // copy that say "No silver-ion, no\nnanoparticles" should pass.
    const negationRx =
      /\b(is not|isn'?t|not a|rather than|never use|forbidden|NEVER\b|no silver-?ion|no silver|no nano)/i;
    if (negationRx.test(line) || negationRx.test(prevLine)) {
      continue;
    }
    // Skip rule / convention comment lines.
    const trimmed = line.trim();
    if (
      (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) &&
      /(rule|voice|forbidden|never|allowed)/i.test(trimmed)
    ) {
      continue;
    }
    for (const p of PATTERNS) {
      const m = line.match(p.rx);
      if (m && typeof m.index === "number") {
        violations.push({
          file: rel,
          line: i + 1,
          col: m.index + 1,
          text: line.trim(),
          pattern: p.label,
        });
      }
    }
  }
  return violations;
}

function main() {
  const argv = process.argv.slice(2);
  const stagedMode = argv.includes("--staged");
  const explicitFiles = argv.filter((a) => !a.startsWith("--"));

  let files: string[];
  if (stagedMode) {
    files = getStagedFiles().map((f) => join(ROOT, f));
  } else if (explicitFiles.length > 0) {
    files = explicitFiles.map((f) => (f.startsWith("/") ? f : join(ROOT, f)));
  } else {
    files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "docs"))];
  }

  const all: Violation[] = [];
  for (const f of files) {
    const rel = f.startsWith(ROOT + "/") ? f.slice(ROOT.length + 1) : f;
    if (isDenylisted(rel)) continue;
    all.push(...scanFile(f));
  }

  if (all.length === 0) {
    console.log("✓ Brand voice scan: no forbidden terms found.");
    process.exit(0);
  }

  console.error(`✗ Brand voice scan: ${all.length} violation(s) found.\n`);
  for (const v of all) {
    console.error(`  ${v.file}:${v.line}:${v.col}  [${v.pattern}]`);
    console.error(`    ${v.text}`);
  }
  console.error(
    "\nFUZE brand voice (CLAUDE.md): use FUZE / metamaterial; NEVER silver / nano variants in customer-facing copy. " +
      "Add an explicit competitor-attribution comment if the line is genuinely about a competitor's chemistry.",
  );
  process.exit(1);
}

main();
